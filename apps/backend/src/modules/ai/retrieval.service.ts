import { Inject, Injectable } from '@nestjs/common';

import { AccessRequestDto, accessRequestSchema } from '../access-requests/dto/access-requests.dto';
import {
  PolicyChunkRepository,
  PolicyChunkSimilarityRow,
} from '../database/repositories/policy-chunk.repository';
import { PolicyDocumentChunk, PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';
import { EMBEDDING_CLIENT, EMBEDDING_DIMENSIONS } from './embedding/embedding.types';
import type { EmbeddingClient } from './embedding/embedding.types';

export const RETRIEVAL_TOP_K = 4;

@Injectable()
export class RetrievalService {
  public constructor(
    @Inject(EMBEDDING_CLIENT) private readonly embeddingClient: EmbeddingClient,
    private readonly policyChunkRepository: PolicyChunkRepository,
  ) {}

  public async retrieve(request: AccessRequestDto): Promise<PolicyDocumentChunk[]> {
    const validatedRequest = accessRequestSchema.parse(request);
    const queryText = this.buildQueryText(validatedRequest.targetEntitlement);
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

  private buildQueryText(targetEntitlement: string): string {
    return `Access entitlement request: ${targetEntitlement}`;
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
