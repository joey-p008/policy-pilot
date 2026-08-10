import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AccessRecommendation,
  AccessRequestDecisionResult,
  PendingAccessRequest,
  PolicyCitation,
} from '@policy-pilot/shared-types';
import { Prisma } from '@prisma/client';

import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import type { Decision } from '../ai/schemas/recommendation.schema';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
  type AccessRequestStatus,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import type { CreateHitlAccessRequestDto } from './dto/hitl-access-requests.dto';
import {
  SEED_HITL_ADMIN_API_ID,
  SEED_HITL_ADMIN_USER_ID,
  SEED_REQUESTOR_EMPLOYEE_ID,
  SEED_REQUESTOR_USER_ID,
} from './seed-ids';

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
  ): Promise<PendingAccessRequest> {
    const requestId = randomUUID();
    const employeeId = SEED_REQUESTOR_EMPLOYEE_ID;

    const entitlements = await this.entitlementRepository.findByUserId(SEED_REQUESTOR_USER_ID);
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
      actorId: SEED_HITL_ADMIN_USER_ID,
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

  public async approve(requestId: string, adminId: string): Promise<AccessRequestDecisionResult> {
    return this.decide(
      requestId,
      adminId,
      ACCESS_REQUEST_STATUS.APPROVED,
      'approved',
      'HUMAN_APPROVED',
    );
  }

  public async deny(requestId: string, adminId: string): Promise<AccessRequestDecisionResult> {
    return this.decide(requestId, adminId, ACCESS_REQUEST_STATUS.DENIED, 'denied', 'HUMAN_DENIED');
  }

  public async escalate(requestId: string, adminId: string): Promise<AccessRequestDecisionResult> {
    return this.decide(
      requestId,
      adminId,
      ACCESS_REQUEST_STATUS.ESCALATED,
      'escalated',
      'HUMAN_ESCALATED',
    );
  }

  private async decide(
    requestId: string,
    adminId: string,
    status: AccessRequestStatus,
    resultStatus: AccessRequestDecisionResult['status'],
    auditAction: string,
  ): Promise<AccessRequestDecisionResult> {
    const existing = await this.accessRequestRepository.findByRequestId(requestId);
    if (existing === null) {
      throw new NotFoundException(`Access request not found: ${requestId}`);
    }
    if (existing.status !== ACCESS_REQUEST_STATUS.PENDING_REVIEW) {
      throw new ConflictException(`Access request is not pending review: ${requestId}`);
    }

    const actorId = this.resolveAdminActorId(adminId);

    await this.accessRequestRepository.markDecided({
      requestId,
      status,
      decidedByAdminId: adminId,
    });

    await this.auditLogService.append({
      requestId,
      actorId,
      action: auditAction,
      previousState: { status: existing.status },
      newState: { status, admin_id: adminId },
    });

    return {
      requestId,
      status: resultStatus,
    };
  }

  private resolveAdminActorId(adminId: string): string {
    if (adminId === SEED_HITL_ADMIN_API_ID) {
      return SEED_HITL_ADMIN_USER_ID;
    }
    throw new BadRequestException(`Unknown admin_id: ${adminId}`);
  }
}
