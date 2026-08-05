import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { IdempotencyService, IdempotentResult } from '../idempotency/idempotency.service';
import {
  ACCESS_REQUEST_QUEUE,
  ACCESS_REQUEST_WORKER_CONCURRENCY,
  ACCESS_REQUEST_WORKER_ENDPOINT,
  ACCESS_REQUEST_WORKER_LIMITER,
  buildWorkerIdempotencyRequestId,
} from './access-requests.constants';
import { AccessRequestDto } from './dto/access-requests.dto';
import { MockDownstreamService } from './mock-downstream.service';

export interface AccessRequestProcessedResponse {
  status: 'processed';
  requestId: string;
}

@Injectable()
@Processor(ACCESS_REQUEST_QUEUE, {
  concurrency: ACCESS_REQUEST_WORKER_CONCURRENCY,
  limiter: {
    max: ACCESS_REQUEST_WORKER_LIMITER.max,
    duration: ACCESS_REQUEST_WORKER_LIMITER.duration,
  },
})
export class AccessRequestWorker extends WorkerHost {
  private readonly logger = new Logger(AccessRequestWorker.name);

  public constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly mockDownstream: MockDownstreamService,
  ) {
    super();
  }

  public async process(
    job: Job<AccessRequestDto>,
  ): Promise<IdempotentResult<AccessRequestProcessedResponse>> {
    const result = await this.idempotencyService.executeIdempotent({
      requestId: buildWorkerIdempotencyRequestId(job.data.requestId),
      endpoint: ACCESS_REQUEST_WORKER_ENDPOINT,
      execute: async (): Promise<AccessRequestProcessedResponse> => {
        await this.mockDownstream.invoke();

        return {
          status: 'processed',
          requestId: job.data.requestId,
        };
      },
    });

    if (result.replayed) {
      this.logger.log(`Skipped already-processed access-request job ${job.id ?? 'unknown'}`);
    } else {
      this.logger.log(`Processed access-request job ${job.id ?? 'unknown'}`);
    }

    return result;
  }
}
