import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessRecommendation,
  AccessRequestDecisionResult,
  AccessRequestHistoryItem,
  AccessRequestHistoryStatus,
  PendingAccessRequest,
  PolicyCitation,
} from '@policy-pilot/shared-types';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import type { Decision } from '../ai/schemas/recommendation.schema';
import type { DemoPrincipal } from '../auth/demo-auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
  type AccessRequestStatus,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import type { CreateHitlAccessRequestDto } from './dto/hitl-access-requests.dto';
import { SEED_REQUESTOR_USER_ID } from './seed-ids';

function mapDecisionToRecommendation(
  decision: Decision,
  chunks: Array<{
    document_id: string;
    page_number: number;
    section_title: string;
    content: string;
  }>,
): AccessRecommendation {
  const contentByKey = new Map(
    chunks.map((chunk) => [
      `${chunk.document_id}|${chunk.page_number}|${chunk.section_title}`,
      chunk.content,
    ]),
  );

  const policyCitations: PolicyCitation[] = decision.policy_citations.map((citation) => {
    const key = `${citation.document_id}|${citation.page_number}|${citation.section_title}`;
    const content = contentByKey.get(key);
    return {
      documentId: citation.document_id,
      pageNumber: citation.page_number,
      sectionTitle: citation.section_title,
      ...(content !== undefined ? { content } : {}),
    };
  });

  return {
    decision: decision.decision,
    rationale: decision.rationale,
    confidenceScore: decision.confidence_score,
    policyCitations,
  };
}

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

@Injectable()
export class HitlAccessRequestsService {
  public constructor(
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly entitlementRepository: EntitlementRepository,
    private readonly retrievalService: RetrievalService,
    private readonly decisionEngineService: DecisionEngineService,
    private readonly auditLogService: AuditLogService,
  ) {}

  public async createWithRecommendation(
    dto: CreateHitlAccessRequestDto,
    principal: DemoPrincipal,
  ): Promise<PendingAccessRequest> {
    const requestId = randomUUID();
    const employeeId = principal.employeeId;

    const entitlements = await this.entitlementRepository.findByUserId(principal.userId);
    const currentEntitlements = entitlements.map(
      (entitlement) => `${entitlement.resourceName}:${entitlement.permissionLevel}`,
    );

    const policyChunks = await this.retrievalService.retrieve({
      requestId,
      targetEntitlement: dto.targetEntitlement,
      justification: dto.justification,
      currentEntitlements,
    });

    const decision = await this.decisionEngineService.decide({
      request: {
        requestId,
        targetEntitlement: dto.targetEntitlement,
        justification: dto.justification,
        currentEntitlements,
      },
      policyChunks,
    });

    const recommendation = mapDecisionToRecommendation(decision, policyChunks);

    await this.accessRequestRepository.create({
      requestId,
      employeeId,
      targetEntitlement: dto.targetEntitlement,
      justification: dto.justification,
      status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
      recommendationJson: recommendation as unknown as Prisma.InputJsonValue,
    });

    await this.auditLogService.append({
      requestId,
      actorId: principal.userId,
      action: 'RECOMMENDATION_CREATED',
      previousState: { status: null },
      newState: {
        status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
        employee_id: employeeId,
        targetEntitlement: dto.targetEntitlement,
        recommendation: recommendation.decision,
      },
    });

    return {
      requestId,
      employeeId,
      targetEntitlement: dto.targetEntitlement,
      justification: dto.justification,
      currentEntitlements,
      recommendation,
    };
  }

  public async listPending(): Promise<PendingAccessRequest[]> {
    const rows = await this.accessRequestRepository.findPendingReview();
    const entitlements = await this.entitlementRepository.findByUserId(SEED_REQUESTOR_USER_ID);
    const currentEntitlements = entitlements.map(
      (entitlement) => `${entitlement.resourceName}:${entitlement.permissionLevel}`,
    );

    return rows.map((row) => ({
      requestId: row.requestId,
      employeeId: row.employeeId,
      targetEntitlement: row.targetEntitlement,
      justification: row.justification,
      currentEntitlements,
      recommendation: parseStoredRecommendation(row.recommendationJson),
    }));
  }

  public async listHistory(): Promise<AccessRequestHistoryItem[]> {
    const rows = await this.accessRequestRepository.findDecided();
    const entitlements = await this.entitlementRepository.findByUserId(SEED_REQUESTOR_USER_ID);
    const currentEntitlements = entitlements.map(
      (entitlement) => `${entitlement.resourceName}:${entitlement.permissionLevel}`,
    );

    return rows.map((row) => ({
      requestId: row.requestId,
      employeeId: row.employeeId,
      targetEntitlement: row.targetEntitlement,
      justification: row.justification,
      currentEntitlements,
      recommendation: parseStoredRecommendation(row.recommendationJson),
      status: toHistoryStatus(row.status),
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

    await this.accessRequestRepository.markDecided({
      requestId,
      status,
      decidedByAdminId: principal.actorId,
    });

    await this.auditLogService.append({
      requestId,
      actorId: principal.userId,
      action: auditAction,
      previousState: { status: existing.status },
      newState: { status, actor_id: principal.actorId },
    });

    return {
      requestId,
      status: toResultStatus(status),
    };
  }
}
