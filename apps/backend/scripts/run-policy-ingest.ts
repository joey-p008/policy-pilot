import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { DocumentIngestionService } from '../src/modules/ai/document-ingestion.service';
import { PrismaService } from '../src/modules/database/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const ingestion = app.get(DocumentIngestionService);
    const prisma = app.get(PrismaService);

    process.stdout.write('Starting ingestPoliciesDirectory()...\n');
    const result = await ingestion.ingestPoliciesDirectory();
    process.stdout.write(
      `INGEST_RESULT documentsProcessed=${result.documentsProcessed} chunksInserted=${result.chunksInserted}\n`,
    );

    const rows = await prisma.$queryRaw<Array<{ document_id: string; count: bigint }>>`
      SELECT document_id, COUNT(*)::bigint AS count
      FROM policy_chunks
      GROUP BY document_id
      ORDER BY document_id
    `;

    for (const row of rows) {
      process.stdout.write(`DB ${row.document_id} chunks=${row.count.toString()}\n`);
    }

    const total = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM policy_chunks
    `;
    process.stdout.write(`DB_TOTAL_CHUNKS ${total[0]?.count.toString() ?? '0'}\n`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  process.stderr.write(`INGEST_FAILED ${message}\n`);
  process.exit(1);
});
