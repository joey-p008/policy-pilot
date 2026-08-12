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

export interface UserResourcePermissionKey {
  userId: string;
  resourceName: string;
  permissionLevel: string;
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

  public async upsertByUserResourcePermission(input: CreateEntitlementInput): Promise<Entitlement> {
    return this.prisma.entitlement.upsert({
      where: {
        userId_resourceName_permissionLevel: {
          userId: input.userId,
          resourceName: input.resourceName,
          permissionLevel: input.permissionLevel,
        },
      },
      create: {
        id: input.id,
        resourceName: input.resourceName,
        permissionLevel: input.permissionLevel,
        expiresAt: input.expiresAt ?? null,
        user: {
          connect: { id: input.userId },
        },
      },
      update: {
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  public async findByUserId(userId: string): Promise<Entitlement[]> {
    return this.prisma.entitlement.findMany({
      where: { userId },
    });
  }

  public async findByUserIds(userIds: string[]): Promise<Entitlement[]> {
    if (userIds.length === 0) {
      return [];
    }

    return this.prisma.entitlement.findMany({
      where: { userId: { in: userIds } },
    });
  }

  public async findByUserResourcePermission(
    key: UserResourcePermissionKey,
  ): Promise<Entitlement | null> {
    return this.prisma.entitlement.findUnique({
      where: {
        userId_resourceName_permissionLevel: {
          userId: key.userId,
          resourceName: key.resourceName,
          permissionLevel: key.permissionLevel,
        },
      },
    });
  }

  public async deleteByUserResourcePermission(key: UserResourcePermissionKey): Promise<number> {
    const result = await this.prisma.entitlement.deleteMany({
      where: {
        userId: key.userId,
        resourceName: key.resourceName,
        permissionLevel: key.permissionLevel,
      },
    });
    return result.count;
  }
}
