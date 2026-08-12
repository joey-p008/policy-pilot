import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AiModule } from '../ai/ai.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AccessGrantQueueService } from './access-grant-queue.service';
import { AccessGrantWorker } from './access-grant.worker';
import { AccessRecommendationService } from './access-recommendation.service';
import { AccessRequestWorker } from './access-request.worker';
import { AccessRequestsHitlController } from './access-requests-hitl.controller';
import {
  ACCESS_GRANT_DEFAULT_JOB_OPTIONS,
  ACCESS_GRANT_QUEUE,
  ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
  ACCESS_REQUEST_QUEUE,
} from './access-requests.constants';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { HitlAccessRequestsService } from './hitl-access-requests.service';
import { MockDownstreamService } from './mock-downstream.service';

@Module({
  imports: [
    IdempotencyModule,
    AiModule,
    AuditLogModule,
    BullModule.registerQueue({
      name: ACCESS_REQUEST_QUEUE,
      defaultJobOptions: ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
    }),
    BullModule.registerQueue({
      name: ACCESS_GRANT_QUEUE,
      defaultJobOptions: ACCESS_GRANT_DEFAULT_JOB_OPTIONS,
    }),
  ],
  controllers: [AccessRequestsController, AccessRequestsHitlController],
  providers: [
    AccessRequestsService,
    HitlAccessRequestsService,
    AccessRecommendationService,
    EntitlementExecutionService,
    AccessGrantQueueService,
    AccessRequestWorker,
    AccessGrantWorker,
    MockDownstreamService,
  ],
  exports: [
    AccessRequestsService,
    HitlAccessRequestsService,
    AccessRecommendationService,
    AccessGrantQueueService,
  ],
})
export class AccessRequestsModule {}
