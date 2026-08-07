import { z } from 'zod';

export const PolicyDocumentChunkSchema = z.object({
  document_id: z.string().min(1),
  page_number: z.number().int().positive(),
  section_title: z.string().min(1),
  content: z.string().min(1),
});

export type PolicyDocumentChunk = z.infer<typeof PolicyDocumentChunkSchema>;

export const ChunkDocumentInputSchema = z.object({
  documentId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  text: z.string(),
  sectionTitle: z.string().min(1).optional(),
});

export type ChunkDocumentInput = z.infer<typeof ChunkDocumentInputSchema>;

export const IngestPoliciesResultSchema = z.object({
  documentsProcessed: z.number().int().nonnegative(),
  chunksInserted: z.number().int().nonnegative(),
});

export type IngestPoliciesResult = z.infer<typeof IngestPoliciesResultSchema>;
