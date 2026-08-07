import { Module } from '@nestjs/common';

import { DocumentIngestionService } from './document-ingestion.service';
import { EMBEDDING_CLIENT } from './embedding/embedding.types';
import { OpenAiEmbeddingClient } from './embedding/openai-embedding.client';

@Module({
  providers: [
    DocumentIngestionService,
    OpenAiEmbeddingClient,
    {
      provide: EMBEDDING_CLIENT,
      useExisting: OpenAiEmbeddingClient,
    },
  ],
  exports: [DocumentIngestionService, EMBEDDING_CLIENT],
})
export class AiModule {}
