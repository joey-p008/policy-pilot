import { Injectable } from '@nestjs/common';
import { AccessAuditLog } from '@prisma/client';
import { maskPII } from '@policy-pilot/shared';

import { AccessAuditLogRepository } from '../database/repositories/access-audit-log.repository';
import { CreateAccessAuditLogInput, createAccessAuditLogSchema } from './dto/audit-log.dto';

@Injectable()
export class AuditLogService {
  public constructor(private readonly accessAuditLogRepository: AccessAuditLogRepository) {}

  public async append(input: CreateAccessAuditLogInput): Promise<AccessAuditLog> {
    const validated = createAccessAuditLogSchema.parse(input);

    return this.accessAuditLogRepository.create({
      id: validated.id,
      requestId: validated.requestId,
      actorId: validated.actorId,
      action: validated.action,
      previousState: maskPII(validated.previousState),
      newState: maskPII(validated.newState),
    });
  }
}
