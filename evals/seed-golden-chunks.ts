import { NestFactory } from '@nestjs/core';

import { AppModule } from '../apps/backend/src/app.module';
import { DocumentIngestionService } from '../apps/backend/src/modules/ai/document-ingestion.service';

import { GOLDEN_DATASET_PATH, loadGoldenPolicyChunks } from './golden-chunks';
import { loadBackendEnv } from './load-backend-env';

function requireOpenAiApiKey(): void {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('OPENAI_API_KEY is not set');
  }
}

async function main(): Promise<void> {
  loadBackendEnv();
  requireOpenAiApiKey();

  const chunks = loadGoldenPolicyChunks();
  if (chunks.length === 0) {
    throw new Error(`No expected_retrieved_chunks found in ${GOLDEN_DATASET_PATH}`);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestion = app.get(DocumentIngestionService);
    process.stdout.write(
      `Seeding ${String(chunks.length)} golden policy chunks from ${GOLDEN_DATASET_PATH}\n`,
    );
    const inserted = await ingestion.persistChunks(chunks);
    process.stdout.write(`SEED_RESULT chunksInserted=${String(inserted)}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`SEED_FAILED ${message}\n`);
  process.exit(1);
});
