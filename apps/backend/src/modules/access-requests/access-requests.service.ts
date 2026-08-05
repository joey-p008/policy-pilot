import { Injectable } from '@nestjs/common';

import { IdempotencyService } from '../idempotency/idempotency.service';
import { AccessRequestDto } from './dto/access-requests.dto';

export const ACCESS_REQUESTS_WEBHOOK_ENDPOINT = '/webhooks/access-requests';

export interface AccessRequestAcceptedResponse {
  status: 'accepted';
  requestId: string;
}

export interface AccessRequestHandleResult {
  replayed: boolean;
  response: AccessRequestAcceptedResponse;
}

@Injectable()
export class AccessRequestsService {
  public constructor(private readonly idempotencyService: IdempotencyService) {}

  public async handleIncoming(dto: AccessRequestDto): Promise<AccessRequestHandleResult> {
    return this.idempotencyService.executeIdempotent({
      requestId: dto.requestId,
      endpoint: ACCESS_REQUESTS_WEBHOOK_ENDPOINT,
      execute: async (): Promise<AccessRequestAcceptedResponse> => ({
        status: 'accepted',
        requestId: dto.requestId,
      }),
    });
  }
}
