import { Module } from '@nestjs/common';

import { DocumentIngestionService } from './document-ingestion.service';
import { EMBEDDING_CLIENT } from './embedding/embedding.types';
import { OpenAiEmbeddingClient } from './embedding/openai-embedding.client';
import { RetrievalService } from './retrieval.service';

@Module({
  providers: [
    DocumentIngestionService,
    RetrievalService,
    OpenAiEmbeddingClient,
    {
      provide: EMBEDDING_CLIENT,
      useExisting: OpenAiEmbeddingClient,
    },
  ],
  exports: [DocumentIngestionService, RetrievalService, EMBEDDING_CLIENT],
})
export class AiModule {}
