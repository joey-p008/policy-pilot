import { Inject, Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import './pdf-dom-polyfill';
import { PDFParse } from 'pdf-parse';

import { PolicyChunkRepository } from '../database/repositories/policy-chunk.repository';
import { DocumentChunker } from './document-chunker';
import {
  IngestPoliciesResult,
  IngestPoliciesResultSchema,
  PolicyDocumentChunk,
  PolicyDocumentChunkSchema,
} from './dto/document-ingestion.dto';
import { EMBEDDING_CLIENT, EMBEDDING_DIMENSIONS } from './embedding/embedding.types';
import type { EmbeddingClient } from './embedding/embedding.types';

@Injectable()
export class DocumentIngestionService {
  private readonly policiesDirectory: string;
  private readonly chunker: DocumentChunker;

  public constructor(
    @Inject(EMBEDDING_CLIENT) private readonly embeddingClient: EmbeddingClient,
    private readonly policyChunkRepository: PolicyChunkRepository,
  ) {
    this.policiesDirectory = join(__dirname, '../../../data/policies');
    this.chunker = new DocumentChunker();
  }

  public async ingestPoliciesDirectory(): Promise<IngestPoliciesResult> {
    const entries = await readdir(this.policiesDirectory);
    const pdfFiles = entries
      .filter((entry) => extname(entry).toLowerCase() === '.pdf')
      .sort((left, right) => left.localeCompare(right));

    let chunksInserted = 0;

    for (const fileName of pdfFiles) {
      const documentId = basename(fileName, extname(fileName));
      const filePath = join(this.policiesDirectory, fileName);
      const pageChunks = await this.ingestPdfFile(filePath, documentId);
      chunksInserted += await this.persistChunks(pageChunks);
    }

    return IngestPoliciesResultSchema.parse({
      documentsProcessed: pdfFiles.length,
      chunksInserted,
    });
  }

  public async ingestPdfFile(filePath: string, documentId: string): Promise<PolicyDocumentChunk[]> {
    const data = await readFile(filePath);
    const parser = new PDFParse({ data });

    try {
      const textResult = await parser.getText();
      const chunks: PolicyDocumentChunk[] = [];

      for (const page of textResult.pages) {
        const pageChunks = await this.chunker.chunkDocument({
          documentId,
          pageNumber: page.num,
          text: page.text,
        });
        chunks.push(...pageChunks);
      }

      return chunks.map((chunk) => PolicyDocumentChunkSchema.parse(chunk));
    } finally {
      await parser.destroy();
    }
  }

  /**
   * Embeds prebuilt policy chunks and bulk-inserts them into Postgres.
   * Replaces any existing rows for the same document_id values (idempotent re-ingest).
   */
  public async persistChunks(chunks: PolicyDocumentChunk[]): Promise<number> {
    const validated = chunks.map((chunk) => PolicyDocumentChunkSchema.parse(chunk));
    if (validated.length === 0) {
      return 0;
    }

    const byDocument = new Map<string, PolicyDocumentChunk[]>();
    for (const chunk of validated) {
      const existing = byDocument.get(chunk.document_id) ?? [];
      existing.push(chunk);
      byDocument.set(chunk.document_id, existing);
    }

    let inserted = 0;

    for (const [documentId, documentChunks] of byDocument) {
      await this.policyChunkRepository.deleteByDocumentId(documentId);

      const texts = documentChunks.map((chunk) => chunk.content);
      const embeddings = await this.embeddingClient.embedTexts(texts);

      if (embeddings.length !== documentChunks.length) {
        throw new Error(
          `Embedding count mismatch for document ${documentId}: expected ${documentChunks.length}, received ${embeddings.length}`,
        );
      }

      const rows = documentChunks.map((chunk, index) => {
        const embedding = embeddings[index];
        if (embedding === undefined) {
          throw new Error(`Missing embedding at index ${index} for document ${documentId}`);
        }
        if (embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Expected embedding length ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`,
          );
        }

        return {
          documentId: chunk.document_id,
          pageNumber: chunk.page_number,
          sectionTitle: chunk.section_title,
          content: chunk.content,
          embedding,
        };
      });

      inserted += await this.policyChunkRepository.bulkInsert(rows);
    }

    return inserted;
  }
}
