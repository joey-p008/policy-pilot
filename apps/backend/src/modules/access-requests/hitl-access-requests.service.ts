import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessRecommendation,
  AccessRequestDecisionResult,
  AccessRequestHistoryItem,
  AccessRequestHistoryStatus,
  AccessRequestProvisioningStatus,
  PendingAccessRequest,
  PolicyCitation,
} from '@policy-pilot/shared-types';
import { Prisma } from '@prisma/client';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { DemoPrincipal } from '../auth/demo-auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
  PROVISIONING_STATUS,
  type AccessRequestStatus,
  type ProvisioningStatus,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { AccessGrantQueueService } from './access-grant-queue.service';
import { AccessRecommendationService } from './access-recommendation.service';
import type { CreateHitlAccessRequestDto } from './dto/hitl-access-requests.dto';
import { EntitlementExecutionService } from './entitlement-execution.service';

function parseStoredRecommendation(value: Prisma.JsonValue): AccessRecommendation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Stored recommendation_json is not an object');
  }
  const record = value as Record<string, unknown>;
  const decision = record.decision;
  const rationale = record.rationale;
  const confidenceScore = record.confidenceScore;
  const policyCitations = record.policyCitations;

  if (
    (decision !== 'APPROVE' && decision !== 'DENY' && decision !== 'ESCALATE') ||
    typeof rationale !== 'string' ||
    typeof confidenceScore !== 'number' ||
    !Array.isArray(policyCitations)
  ) {
    throw new Error('Stored recommendation_json failed shape validation');
  }

  return {
    decision,
    rationale,
    confidenceScore,
    policyCitations: policyCitations as PolicyCitation[],
  };
}

function toHistoryStatus(status: string): AccessRequestHistoryStatus {
  if (status === ACCESS_REQUEST_STATUS.APPROVED) {
    return 'APPROVED';
  }
  if (status === ACCESS_REQUEST_STATUS.DENIED) {
    return 'DENIED';
  }
  if (status === ACCESS_REQUEST_STATUS.ESCALATED) {
    return 'ESCALATED';
  }
  throw new Error(`Unexpected decided status: ${status}`);
}

function toResultStatus(status: AccessRequestStatus): AccessRequestDecisionResult['status'] {
  if (status === ACCESS_REQUEST_STATUS.APPROVED) {
    return 'approved';
  }
  if (status === ACCESS_REQUEST_STATUS.DENIED) {
    return 'denied';
  }
  if (status === ACCESS_REQUEST_STATUS.ESCALATED) {
    return 'escalated';
  }
  throw new Error(`Unexpected decision status: ${status}`);
}

function toProvisioningStatus(status: string): AccessRequestProvisioningStatus {
  if (
    status === PROVISIONING_STATUS.QUEUED ||
    status === PROVISIONING_STATUS.PROVISIONED ||
    status === PROVISIONING_STATUS.FAILED ||
    status === PROVISIONING_STATUS.NOT_APPLICABLE
  ) {
    return status;
  }
  throw new Error(`Unexpected provisioning status: ${status}`);
}

@Injectable()
export class HitlAccessRequestsService {
  public constructor(
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly entitlementRepository: EntitlementRepository,
    private readonly userRepository: UserRepository,
    private readonly accessRecommendationService: AccessRecommendationService,
    private readonly entitlementExecutionService: EntitlementExecutionService,
    private readonly accessGrantQueueService: AccessGrantQueueService,
    private readonly auditLogService: AuditLogService,
  ) {}

  public async createWithRecommendation(
    dto: CreateHitlAccessRequestDto,
    principal: DemoPrincipal,
  ): Promise<PendingAccessRequest> {
    return this.accessRecommendationService.createWithRecommendation({
      requestId: randomUUID(),
      employeeId: principal.employeeId,
      actorUserId: principal.userId,
      entitlementUserId: principal.userId,
      title: dto.title,
      department: dto.department,
      costCenter: dto.costCenter,
      systemName: dto.systemName,
      entitlementKey: dto.entitlementKey,
      justification: dto.justification,
    });
  }

  public async listPending(): Promise<PendingAccessRequest[]> {
    const rows = await this.accessRequestRepository.findPendingReview();
    const entitlementsByEmployeeId = await this.loadEntitlementsByEmployeeId(
      rows.map((row) => row.employeeId),
    );

    return rows.map((row) => ({
      requestId: row.requestId,
      employeeId: row.employeeId,
      title: row.title,
      department: row.department,
      costCenter: row.costCenter,
      systemName: row.systemName,
      targetEntitlement: row.targetEntitlement,
      justification: row.justification,
      currentEntitlements: entitlementsByEmployeeId.get(row.employeeId) ?? [],
      recommendation: parseStoredRecommendation(row.recommendationJson),
    }));
  }

  public async listHistory(): Promise<AccessRequestHistoryItem[]> {
    const rows = await this.accessRequestRepository.findDecided();
    const entitlementsByEmployeeId = await this.loadEntitlementsByEmployeeId(
      rows.map((row) => row.employeeId),
    );

    return rows.map((row) => ({
      requestId: row.requestId,
      employeeId: row.employeeId,
      title: row.title,
      department: row.department,
      costCenter: row.costCenter,
      systemName: row.systemName,
      targetEntitlement: row.targetEntitlement,
      justification: row.justification,
      currentEntitlements: entitlementsByEmployeeId.get(row.employeeId) ?? [],
      recommendation: parseStoredRecommendation(row.recommendationJson),
      status: toHistoryStatus(row.status),
      provisioningStatus: toProvisioningStatus(row.provisioningStatus),
      decidedAt: (row.decidedAt ?? row.createdAt).toISOString(),
      decidedByAdminId: row.decidedByAdminId,
    }));
  }

  public async approve(
    requestId: string,
    principal: DemoPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.decide(requestId, principal, ACCESS_REQUEST_STATUS.APPROVED, 'HUMAN_APPROVED');
  }

  public async deny(
    requestId: string,
    principal: DemoPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.decide(requestId, principal, ACCESS_REQUEST_STATUS.DENIED, 'HUMAN_DENIED');
  }

  public async escalate(
    requestId: string,
    principal: DemoPrincipal,
  ): Promise<AccessRequestDecisionResult> {
    return this.decide(requestId, principal, ACCESS_REQUEST_STATUS.ESCALATED, 'HUMAN_ESCALATED');
  }

  private async decide(
    requestId: string,
    principal: DemoPrincipal,
    status: AccessRequestStatus,
    firstDecisionAuditAction: string,
  ): Promise<AccessRequestDecisionResult> {
    const existing = await this.accessRequestRepository.findByRequestId(requestId);
    if (existing === null) {
      throw new NotFoundException(`Access request not found: ${requestId}`);
    }

    const isPending = existing.status === ACCESS_REQUEST_STATUS.PENDING_REVIEW;
    const isDecided =
      existing.status === ACCESS_REQUEST_STATUS.APPROVED ||
      existing.status === ACCESS_REQUEST_STATUS.DENIED ||
      existing.status === ACCESS_REQUEST_STATUS.ESCALATED;

    if (!isPending && !isDecided) {
      throw new ConflictException(`Access request cannot be decided: ${requestId}`);
    }

    if (existing.status === status) {
      throw new ConflictException(`Access request already has status ${status}: ${requestId}`);
    }

    const auditAction = isPending ? firstDecisionAuditAction : 'HUMAN_DECISION_OVERRIDE';
    const executionInput = {
      requestId: existing.requestId,
      employeeId: existing.employeeId,
      actorUserId: principal.userId,
      systemName: existing.systemName,
      targetEntitlement: existing.targetEntitlement,
    };

    if (
      status !== ACCESS_REQUEST_STATUS.APPROVED &&
      existing.status === ACCESS_REQUEST_STATUS.APPROVED
    ) {
      // Withdraw the grant before reversing the decision, so a job still
      // waiting on downstream capacity cannot provision access the admin has
      // just taken away. Anything already executed is undone by the revoke.
      await this.accessGrantQueueService.cancelQueuedGrant(requestId);
      await this.entitlementExecutionService.revoke(executionInput);
    }

    const provisioningStatus: ProvisioningStatus =
      status === ACCESS_REQUEST_STATUS.APPROVED
        ? PROVISIONING_STATUS.QUEUED
        : PROVISIONING_STATUS.NOT_APPLICABLE;

    await this.accessRequestRepository.markDecided({
      requestId,
      status,
      provisioningStatus,
      decidedByAdminId: principal.actorId,
    });

    await this.auditLogService.append({
      requestId,
      actorId: principal.userId,
      action: auditAction,
      previousState: { status: existing.status },
      newState: { status, actor_id: principal.actorId, provisioning_status: provisioningStatus },
    });

    // Enqueued last, so the worker can never observe a request that is not yet
    // recorded as APPROVED and QUEUED in Postgres.
    if (status === ACCESS_REQUEST_STATUS.APPROVED) {
      await this.accessGrantQueueService.enqueueGrant(executionInput);
    }

    return {
      requestId,
      status: toResultStatus(status),
      provisioningStatus,
    };
  }

  private async loadEntitlementsByEmployeeId(
    employeeIds: string[],
  ): Promise<Map<string, string[]>> {
    const uniqueEmployeeIds = [...new Set(employeeIds)];
    const entitlementsByEmployeeId = new Map<string, string[]>();
    for (const employeeId of uniqueEmployeeIds) {
      entitlementsByEmployeeId.set(employeeId, []);
    }

    if (uniqueEmployeeIds.length === 0) {
      return entitlementsByEmployeeId;
    }

    const hashToEmployeeId = new Map(
      uniqueEmployeeIds.map((employeeId) => [hashIdentifier(employeeId), employeeId]),
    );
    const users = await this.userRepository.findByEmployeeIdHashes([...hashToEmployeeId.keys()]);
    const employeeIdByUserId = new Map<string, string>();
    for (const user of users) {
      const employeeId = hashToEmployeeId.get(user.employeeIdHash);
      if (employeeId !== undefined) {
        employeeIdByUserId.set(user.id, employeeId);
      }
    }

    const entitlements = await this.entitlementRepository.findByUserIds(
      users.map((user) => user.id),
    );
    for (const entitlement of entitlements) {
      const employeeId = employeeIdByUserId.get(entitlement.userId);
      if (employeeId === undefined) {
        continue;
      }
      const current = entitlementsByEmployeeId.get(employeeId) ?? [];
      current.push(`${entitlement.resourceName}:${entitlement.permissionLevel}`);
      entitlementsByEmployeeId.set(employeeId, current);
    }

    return entitlementsByEmployeeId;
  }
}
