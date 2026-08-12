import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  ACCESS_REQUEST_JOB_ATTEMPTS,
  ACCESS_REQUEST_JOB_NAME,
  ACCESS_REQUEST_QUEUE,
  ACCESS_REQUESTS_WEBHOOK_ENDPOINT,
  buildAccessRequestBackoffDelayMs,
  buildAccessRequestStatusUrl,
} from './access-requests.constants';
import { AccessRequestDto } from './dto/access-requests.dto';

export interface AccessRequestAcceptedResponse {
  status: 'accepted';
  requestId: string;
  statusUrl: string;
}

export interface AccessRequestHandleResult {
  replayed: boolean;
  response: AccessRequestAcceptedResponse;
}

@Injectable()
export class AccessRequestsService {
  public constructor(
    private readonly idempotencyService: IdempotencyService,
    @InjectQueue(ACCESS_REQUEST_QUEUE)
    private readonly accessRequestQueue: Queue<AccessRequestDto>,
  ) {}

  public async handleIncoming(dto: AccessRequestDto): Promise<AccessRequestHandleResult> {
    return this.idempotencyService.executeIdempotent({
      requestId: dto.request_id,
      endpoint: ACCESS_REQUESTS_WEBHOOK_ENDPOINT,
      execute: async (): Promise<AccessRequestAcceptedResponse> => {
        await this.accessRequestQueue.add(ACCESS_REQUEST_JOB_NAME, dto, {
          jobId: dto.request_id,
          attempts: ACCESS_REQUEST_JOB_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: buildAccessRequestBackoffDelayMs(),
          },
        });

        return {
          status: 'accepted',
          requestId: dto.request_id,
          statusUrl: buildAccessRequestStatusUrl(dto.request_id),
        };
      },
    });
  }
}
