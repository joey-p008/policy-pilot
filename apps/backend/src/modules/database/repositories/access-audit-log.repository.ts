import { Injectable } from '@nestjs/common';
import { AccessAuditLog, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import {
  CreateAccessAuditLogInput,
  createAccessAuditLogSchema,
} from '../schemas/access-audit-log.schema';

@Injectable()
export class AccessAuditLogRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateAccessAuditLogInput): Promise<AccessAuditLog> {
    const validated = createAccessAuditLogSchema.parse(input);

    return this.prisma.accessAuditLog.create({
      data: {
        id: validated.id,
        requestId: validated.requestId,
        action: validated.action,
        previousState: validated.previousState as Prisma.InputJsonValue,
        newState: validated.newState as Prisma.InputJsonValue,
        actor: {
          connect: { id: validated.actorId },
        },
      },
    });
  }
}
