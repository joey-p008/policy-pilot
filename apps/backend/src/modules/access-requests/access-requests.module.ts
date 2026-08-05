import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AccessRequestProcessor } from './access-request.processor';
import { ACCESS_REQUEST_QUEUE } from './access-requests.constants';
import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestsService } from './access-requests.service';

@Module({
  imports: [
    IdempotencyModule,
    BullModule.registerQueue({
      name: ACCESS_REQUEST_QUEUE,
    }),
  ],
  controllers: [AccessRequestsController],
  providers: [AccessRequestsService, AccessRequestProcessor],
  exports: [AccessRequestsService],
})
export class AccessRequestsModule {}
