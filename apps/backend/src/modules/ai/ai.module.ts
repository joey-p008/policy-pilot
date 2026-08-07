import { Module } from '@nestjs/common';

import { DocumentIngestionService } from './document-ingestion.service';

@Module({
  providers: [DocumentIngestionService],
  exports: [DocumentIngestionService],
})
export class AiModule {}
