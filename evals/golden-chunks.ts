import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import {
  PolicyDocumentChunkSchema,
  type PolicyDocumentChunk,
} from '../apps/backend/src/modules/ai/dto/document-ingestion.dto';

const ROOT_DIR = resolve(__dirname, '..');
export const GOLDEN_DATASET_PATH = join(ROOT_DIR, 'evals', 'golden_dataset.json');

const ExpectedRetrievedChunkSchema = z.object({
  document_id: z.string().min(1),
  page_number: z.number().int().positive(),
  section_title: z.string().min(1),
  excerpt: z.string().min(1),
});

const GoldenFileSchema = z
  .array(
    z.object({
      expected_retrieved_chunks: z.array(ExpectedRetrievedChunkSchema),
    }),
  )
  .min(1);

export type GoldenExpectedChunk = z.infer<typeof ExpectedRetrievedChunkSchema>;

function chunkIdentityKey(chunk: PolicyDocumentChunk): string {
  return `${chunk.document_id}\0${String(chunk.page_number)}\0${chunk.section_title}\0${chunk.content}`;
}

export function mapGoldenExcerptsToPolicyChunks(
  expectedChunks: ReadonlyArray<GoldenExpectedChunk>,
): PolicyDocumentChunk[] {
  const unique = new Map<string, PolicyDocumentChunk>();

  for (const expected of expectedChunks) {
    const mapped = PolicyDocumentChunkSchema.parse({
      document_id: expected.document_id,
      page_number: expected.page_number,
      section_title: expected.section_title,
      content: expected.excerpt,
    });
    unique.set(chunkIdentityKey(mapped), mapped);
  }

  return [...unique.values()];
}

export function loadGoldenPolicyChunks(
  datasetPath: string = GOLDEN_DATASET_PATH,
): PolicyDocumentChunk[] {
  const parsed: unknown = JSON.parse(readFileSync(datasetPath, 'utf8'));
  const scenarios = GoldenFileSchema.parse(parsed);
  const excerpts = scenarios.flatMap((scenario) => scenario.expected_retrieved_chunks);
  return mapGoldenExcerptsToPolicyChunks(excerpts);
}
