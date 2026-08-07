import { Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { PDFParse } from 'pdf-parse';

import { DocumentChunker } from './document-chunker';
import { PolicyDocumentChunk, PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';

@Injectable()
export class DocumentIngestionService {
  private readonly policiesDirectory: string;
  private readonly chunker: DocumentChunker;

  public constructor() {
    this.policiesDirectory = join(__dirname, '../../../data/policies');
    this.chunker = new DocumentChunker();
  }

  public async ingestPoliciesDirectory(): Promise<PolicyDocumentChunk[]> {
    const entries = await readdir(this.policiesDirectory);
    const pdfFiles = entries
      .filter((entry) => extname(entry).toLowerCase() === '.pdf')
      .sort((left, right) => left.localeCompare(right));

    const chunks: PolicyDocumentChunk[] = [];

    for (const fileName of pdfFiles) {
      const documentId = basename(fileName, extname(fileName));
      const filePath = join(this.policiesDirectory, fileName);
      const pageChunks = await this.ingestPdfFile(filePath, documentId);
      chunks.push(...pageChunks);
    }

    return chunks;
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
}
