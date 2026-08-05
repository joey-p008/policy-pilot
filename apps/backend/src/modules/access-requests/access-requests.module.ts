import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AccessRequestWorker } from './access-request.worker';
import {
  ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
  ACCESS_REQUEST_QUEUE,
} from './access-requests.constants';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { MockDownstreamService } from './mock-downstream.service';

@Module({
  imports: [
    IdempotencyModule,
    BullModule.registerQueue({
      name: ACCESS_REQUEST_QUEUE,
      defaultJobOptions: ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
    }),
  ],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService, AccessRequestWorker, MockDownstreamService],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
