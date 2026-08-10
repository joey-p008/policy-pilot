import { Module } from '@nestjs/common';

import { CHAT_CLIENT } from './chat/chat.types';
import { OpenAiChatClient } from './chat/openai-chat.client';
import { DecisionEngineService } from './decision-engine.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { EMBEDDING_CLIENT } from './embedding/embedding.types';
import { OpenAiEmbeddingClient } from './embedding/openai-embedding.client';
import { RetrievalService } from './retrieval.service';

@Module({
  providers: [
    DocumentIngestionService,
    RetrievalService,
    DecisionEngineService,
    OpenAiEmbeddingClient,
    OpenAiChatClient,
    {
      provide: EMBEDDING_CLIENT,
      useExisting: OpenAiEmbeddingClient,
    },
    {
      provide: CHAT_CLIENT,
      useExisting: OpenAiChatClient,
    },
  ],
  exports: [
    DocumentIngestionService,
    RetrievalService,
    DecisionEngineService,
    EMBEDDING_CLIENT,
    CHAT_CLIENT,
  ],
})
export class AiModule {}
