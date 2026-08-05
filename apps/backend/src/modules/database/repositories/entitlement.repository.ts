import { Injectable } from '@nestjs/common';
import { Entitlement } from '@prisma/client';

import { PrismaService } from '../prisma.service';

export interface CreateEntitlementInput {
  userId: string;
  resourceName: string;
  permissionLevel: string;
  expiresAt?: Date | null;
  id?: string;
}

@Injectable()
export class EntitlementRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateEntitlementInput): Promise<Entitlement> {
    return this.prisma.entitlement.create({
      data: {
        id: input.id,
        resourceName: input.resourceName,
        permissionLevel: input.permissionLevel,
        expiresAt: input.expiresAt ?? null,
        user: {
          connect: { id: input.userId },
        },
      },
    });
  }

  public async findByUserId(userId: string): Promise<Entitlement[]> {
    return this.prisma.entitlement.findMany({
      where: { userId },
    });
  }
}
