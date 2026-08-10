import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  PolicyChunkRepository,
  PolicyChunkSimilarityRow,
} from '../database/repositories/policy-chunk.repository';
import { PolicyDocumentChunk, PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';
import { EMBEDDING_CLIENT, EMBEDDING_DIMENSIONS } from './embedding/embedding.types';
import type { EmbeddingClient } from './embedding/embedding.types';

export const RETRIEVAL_TOP_K = 4;

const retrievalRequestSchema = z.object({
  requestId: z.string().min(1),
  targetEntitlement: z.string().min(1),
  justification: z.string().min(1).optional(),
});

export type RetrievalRequest = z.infer<typeof retrievalRequestSchema>;

@Injectable()
export class RetrievalService {
  public constructor(
    @Inject(EMBEDDING_CLIENT) private readonly embeddingClient: EmbeddingClient,
    private readonly policyChunkRepository: PolicyChunkRepository,
  ) {}

  public async retrieve(request: RetrievalRequest): Promise<PolicyDocumentChunk[]> {
    const validatedRequest = retrievalRequestSchema.parse(request);
    const queryText = this.buildQueryText(
      validatedRequest.targetEntitlement,
      validatedRequest.justification,
    );
    const embeddings = await this.embeddingClient.embedTexts([queryText]);
    const embedding = embeddings[0];

    if (embedding === undefined) {
      throw new Error('Embedding client returned no vector for the retrieval query');
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected embedding dimensions ${EMBEDDING_DIMENSIONS}, received ${embedding.length}`,
      );
    }

    const rows = await this.policyChunkRepository.findTopSimilar(embedding, RETRIEVAL_TOP_K);
    return rows.map((row) => this.toPolicyDocumentChunk(row));
  }

  private buildQueryText(targetEntitlement: string, justification?: string): string {
    if (justification === undefined || justification.trim().length === 0) {
      return `Access entitlement request: ${targetEntitlement}`;
    }
    return `Access entitlement request: ${targetEntitlement}. Business justification: ${justification}`;
  }

  private toPolicyDocumentChunk(row: PolicyChunkSimilarityRow): PolicyDocumentChunk {
    return PolicyDocumentChunkSchema.parse({
      document_id: row.documentId,
      page_number: row.pageNumber,
      section_title: row.sectionTitle,
      content: row.content,
    });
  }
}
