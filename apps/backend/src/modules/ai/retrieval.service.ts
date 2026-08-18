import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import {
  PolicyChunkRepository,
  type PolicyChunkSimilarityRow,
} from '../database/repositories/policy-chunk.repository';
import { DEFAULT_SECTION_TITLE } from './document-chunker';
import { PolicyDocumentChunk, PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';
import { EMBEDDING_CLIENT, EMBEDDING_DIMENSIONS } from './embedding/embedding.types';
import type { EmbeddingClient } from './embedding/embedding.types';
import { resolvePolicyDocumentPrefix } from './system-policy-document-prefix';

export const RETRIEVAL_TOP_K = 4;
export const RETRIEVAL_CANDIDATE_LIMIT = RETRIEVAL_TOP_K * 2;

const retrievalRequestSchema = z.object({
  requestId: z.string().min(1),
  targetEntitlement: z.string().min(1),
  justification: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  costCenter: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  targetResource: z.string().min(1).optional(),
  currentEntitlements: z.array(z.string()).optional(),
});

export type RetrievalRequest = z.infer<typeof retrievalRequestSchema>;

function isGeneralSectionTitle(title: string): boolean {
  return title.trim().toLowerCase() === DEFAULT_SECTION_TITLE.toLowerCase();
}

function preferNamedSectionRows(
  rows: ReadonlyArray<PolicyChunkSimilarityRow>,
): PolicyChunkSimilarityRow[] {
  const named: PolicyChunkSimilarityRow[] = [];
  const general: PolicyChunkSimilarityRow[] = [];

  for (const row of rows) {
    if (isGeneralSectionTitle(row.sectionTitle)) {
      general.push(row);
    } else {
      named.push(row);
    }
  }

  return [...named, ...general].slice(0, RETRIEVAL_TOP_K);
}

@Injectable()
export class RetrievalService {
  public constructor(
    @Inject(EMBEDDING_CLIENT) private readonly embeddingClient: EmbeddingClient,
    private readonly policyChunkRepository: PolicyChunkRepository,
  ) {}

  public async retrieve(request: RetrievalRequest): Promise<PolicyDocumentChunk[]> {
    const validatedRequest = retrievalRequestSchema.parse(request);
    const queryText = this.buildQueryText(validatedRequest);
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

    const documentIdPrefix = resolvePolicyDocumentPrefix(validatedRequest.targetResource ?? '');
    const rows = await this.policyChunkRepository.findTopSimilar(
      embedding,
      RETRIEVAL_CANDIDATE_LIMIT,
      documentIdPrefix === undefined ? undefined : { documentIdPrefix },
    );
    return preferNamedSectionRows(rows).map((row) => this.toPolicyDocumentChunk(row));
  }

  private buildQueryText(request: RetrievalRequest): string {
    const parts: string[] = [`Access entitlement request: ${request.targetEntitlement}`];

    if (request.title !== undefined && request.title.trim().length > 0) {
      parts.push(`Requester title: ${request.title.trim()}`);
    }
    if (request.department !== undefined && request.department.trim().length > 0) {
      parts.push(`Department: ${request.department.trim()}`);
    }
    if (request.costCenter !== undefined && request.costCenter.trim().length > 0) {
      parts.push(`Cost center: ${request.costCenter.trim()}`);
    }
    if (request.targetResource !== undefined && request.targetResource.trim().length > 0) {
      parts.push(`Target resource: ${request.targetResource.trim()}`);
    }
    if (request.currentEntitlements !== undefined && request.currentEntitlements.length > 0) {
      parts.push(`Current entitlements: ${request.currentEntitlements.join(', ')}`);
    }
    if (request.justification !== undefined && request.justification.trim().length > 0) {
      parts.push(`Business justification: ${request.justification.trim()}`);
    }

    return parts.join('. ');
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
