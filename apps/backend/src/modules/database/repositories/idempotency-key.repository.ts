import { Injectable } from '@nestjs/common';
import { IdempotencyKey, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma.service';

export interface CreateIdempotencyKeyInput {
  requestId: string;
  endpoint: string;
  responsePayload: Prisma.InputJsonValue;
}

export type UpsertIdempotencyKeyInput = CreateIdempotencyKeyInput;

@Injectable()
export class IdempotencyKeyRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateIdempotencyKeyInput): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.create({
      data: {
        requestId: input.requestId,
        endpoint: input.endpoint,
        responsePayload: input.responsePayload,
      },
    });
  }

  public async upsert(input: UpsertIdempotencyKeyInput): Promise<IdempotencyKey> {
    return this.prisma.idempotencyKey.upsert({
      where: { requestId: input.requestId },
      create: {
        requestId: input.requestId,
        endpoint: input.endpoint,
        responsePayload: input.responsePayload,
      },
      update: {
        endpoint: input.endpoint,
        responsePayload: input.responsePayload,
      },
    });
  }

  public async findByRequestId(requestId: string): Promise<IdempotencyKey | null> {
    return this.prisma.idempotencyKey.findUnique({
      where: { requestId },
    });
  }
}
