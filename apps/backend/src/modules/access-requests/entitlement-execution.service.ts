import { Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  ACCESS_GRANT_IDEMPOTENCY_ENDPOINT,
  buildGrantIdempotencyRequestId,
} from './access-requests.constants';
import {
  entitlementExecutionInputSchema,
  type EntitlementExecutionInput,
} from './dto/entitlement-execution.dto';
import { MockDownstreamService } from './mock-downstream.service';

const grantResponseSchema = z.object({
  status: z.literal('granted'),
  requestId: z.string().min(1),
  userId: z.string().uuid(),
  resourceName: z.string().min(1),
  permissionLevel: z.string().min(1),
});

export type EntitlementGrantResponse = z.infer<typeof grantResponseSchema>;

@Injectable()
export class EntitlementExecutionService {
  public constructor(
    private readonly userRepository: UserRepository,
    private readonly entitlementRepository: EntitlementRepository,
    private readonly mockDownstream: MockDownstreamService,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditLogService: AuditLogService,
  ) {}

  public async grant(input: EntitlementExecutionInput): Promise<EntitlementGrantResponse> {
    const validated = entitlementExecutionInputSchema.parse(input);
    const user = await this.resolveUser(validated.employeeId, validated.requestId);

    const result = await this.idempotencyService.executeIdempotent({
      requestId: buildGrantIdempotencyRequestId(validated.requestId),
      endpoint: ACCESS_GRANT_IDEMPOTENCY_ENDPOINT,
      execute: async (): Promise<EntitlementGrantResponse> => {
        // Downstream first: a rate-limit rejection must leave no trace, or a
        // retried job would find an entitlement already granted with no
        // matching audit row.
        await this.mockDownstream.invoke();

        await this.entitlementRepository.upsertByUserResourcePermission({
          userId: user.id,
          resourceName: validated.systemName,
          permissionLevel: validated.targetEntitlement,
        });

        await this.auditLogService.append({
          requestId: validated.requestId,
          actorId: validated.actorUserId,
          action: 'ACCESS_GRANTED',
          previousState: { status: null },
          newState: {
            employee_id: validated.employeeId,
            system_name: validated.systemName,
            entitlement_key: validated.targetEntitlement,
            user_id: user.id,
          },
        });

        return grantResponseSchema.parse({
          status: 'granted',
          requestId: validated.requestId,
          userId: user.id,
          resourceName: validated.systemName,
          permissionLevel: validated.targetEntitlement,
        });
      },
    });

    return grantResponseSchema.parse(result.response);
  }

  public async revoke(input: EntitlementExecutionInput): Promise<void> {
    const validated = entitlementExecutionInputSchema.parse(input);
    const user = await this.resolveUser(validated.employeeId, validated.requestId);

    const deleted = await this.entitlementRepository.deleteByUserResourcePermission({
      userId: user.id,
      resourceName: validated.systemName,
      permissionLevel: validated.targetEntitlement,
    });

    if (deleted === 0) {
      return;
    }

    await this.auditLogService.append({
      requestId: validated.requestId,
      actorId: validated.actorUserId,
      action: 'ACCESS_REVOKED',
      previousState: {
        system_name: validated.systemName,
        entitlement_key: validated.targetEntitlement,
      },
      newState: { status: 'revoked', user_id: user.id },
    });
  }

  private async resolveUser(employeeId: string, requestId: string): Promise<{ id: string }> {
    const user = await this.userRepository.findByEmployeeIdHash(hashIdentifier(employeeId));
    if (user === null) {
      throw new NotFoundException(`No user found for access request ${requestId}`);
    }
    return user;
  }
}
