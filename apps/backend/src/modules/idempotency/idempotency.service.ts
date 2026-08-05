import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { IdempotencyKeyRepository } from '../database/repositories/idempotency-key.repository';
import { idempotencyLookupSchema, idempotencyStoreSchema } from './dto/idempotency.dto';

export interface ExecuteIdempotentParams<T> {
  requestId: string;
  endpoint: string;
  execute: () => Promise<T>;
}

export interface IdempotentResult<T> {
  replayed: boolean;
  response: T;
}

@Injectable()
export class IdempotencyService {
  public constructor(private readonly idempotencyKeyRepository: IdempotencyKeyRepository) {}

  public async executeIdempotent<T>(
    params: ExecuteIdempotentParams<T>,
  ): Promise<IdempotentResult<T>> {
    const { requestId, endpoint } = idempotencyLookupSchema.parse({
      requestId: params.requestId,
      endpoint: params.endpoint,
    });

    const existing = await this.idempotencyKeyRepository.findByRequestId(requestId);

    if (existing !== null) {
      return {
        replayed: true,
        response: existing.responsePayload as T,
      };
    }

    const response = await params.execute();

    const storeInput = idempotencyStoreSchema.parse({
      requestId,
      endpoint,
      responsePayload: response,
    });

    try {
      await this.idempotencyKeyRepository.create({
        requestId: storeInput.requestId,
        endpoint: storeInput.endpoint,
        responsePayload: storeInput.responsePayload as Prisma.InputJsonValue,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.idempotencyKeyRepository.findByRequestId(requestId);

        if (raced === null) {
          throw error;
        }

        return {
          replayed: true,
          response: raced.responsePayload as T,
        };
      }

      throw error;
    }

    return {
      replayed: false,
      response,
    };
  }
}
