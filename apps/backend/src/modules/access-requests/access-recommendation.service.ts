import { Injectable } from '@nestjs/common';
import type {
  AccessRecommendation,
  PendingAccessRequest,
  PolicyCitation,
} from '@policy-pilot/shared-types';
import { Prisma } from '@prisma/client';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import type { Decision } from '../ai/schemas/recommendation.schema';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import type { AccessRequestDto } from './dto/access-requests.dto';
import { SEED_SYSTEM_INGEST_USER_ID } from './seed-ids';

export interface CreateRecommendationInput {
  requestId: string;
  employeeId: string;
  actorUserId: string;
  entitlementUserId: string | null;
  title: string;
  department: string;
  costCenter: string;
  systemName: string;
  entitlementKey: string;
  justification: string;
}

function mapCurrentEntitlements(
  entitlements: Array<{ resourceName: string; permissionLevel: string }>,
): string[] {
  return entitlements.map(
    (entitlement) => `${entitlement.resourceName}:${entitlement.permissionLevel}`,
  );
}

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
export class AccessRecommendationService {
  public constructor(
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly entitlementRepository: EntitlementRepository,
    private readonly userRepository: UserRepository,
    private readonly retrievalService: RetrievalService,
    private readonly decisionEngineService: DecisionEngineService,
    private readonly auditLogService: AuditLogService,
  ) {}

  public async createFromWebhook(dto: AccessRequestDto): Promise<PendingAccessRequest> {
    const user = await this.userRepository.findByEmployeeIdHash(hashIdentifier(dto.employee_id));

    return this.createWithRecommendation({
      requestId: dto.request_id,
      employeeId: dto.employee_id,
      actorUserId: user?.id ?? SEED_SYSTEM_INGEST_USER_ID,
      entitlementUserId: user?.id ?? null,
      title: dto.requester.title,
      department: dto.requester.department,
      costCenter: dto.requester.cost_center,
      systemName: dto.target.system_name,
      entitlementKey: dto.target.entitlement_key,
      justification: dto.target.justification,
    });
  }

  public async createWithRecommendation(
    input: CreateRecommendationInput,
  ): Promise<PendingAccessRequest> {
    const existing = await this.accessRequestRepository.findByRequestId(input.requestId);
    if (existing !== null) {
      const entitlements =
        input.entitlementUserId === null
          ? []
          : await this.entitlementRepository.findByUserId(input.entitlementUserId);
      return {
        requestId: existing.requestId,
        employeeId: existing.employeeId,
        title: existing.title,
        department: existing.department,
        costCenter: existing.costCenter,
        systemName: existing.systemName,
        targetEntitlement: existing.targetEntitlement,
        justification: existing.justification,
        currentEntitlements: mapCurrentEntitlements(entitlements),
        recommendation: parseStoredRecommendation(existing.recommendationJson),
      };
    }

    const entitlements =
      input.entitlementUserId === null
        ? []
        : await this.entitlementRepository.findByUserId(input.entitlementUserId);
    const currentEntitlements = mapCurrentEntitlements(entitlements);

    const policyChunks = await this.retrievalService.retrieve({
      requestId: input.requestId,
      targetEntitlement: input.entitlementKey,
      justification: input.justification,
      title: input.title,
      department: input.department,
      costCenter: input.costCenter,
      targetResource: input.systemName,
      currentEntitlements,
    });

    const decision = await this.decisionEngineService.decide({
      request: {
        requestId: input.requestId,
        targetEntitlement: input.entitlementKey,
        justification: input.justification,
        title: input.title,
        department: input.department,
        costCenter: input.costCenter,
        targetResource: input.systemName,
        currentEntitlements,
      },
      policyChunks,
    });

    const recommendation = mapDecisionToRecommendation(decision, policyChunks);

    await this.accessRequestRepository.create({
      requestId: input.requestId,
      employeeId: input.employeeId,
      title: input.title,
      department: input.department,
      costCenter: input.costCenter,
      systemName: input.systemName,
      targetEntitlement: input.entitlementKey,
      justification: input.justification,
      status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
      recommendationJson: recommendation as unknown as Prisma.InputJsonValue,
    });

    await this.auditLogService.append({
      requestId: input.requestId,
      actorId: input.actorUserId,
      action: 'RECOMMENDATION_CREATED',
      previousState: { status: null },
      newState: {
        status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
        employee_id: input.employeeId,
        cost_center: input.costCenter,
        title: input.title,
        department: input.department,
        system_name: input.systemName,
        entitlement_key: input.entitlementKey,
        recommendation: recommendation.decision,
      },
    });

    return {
      requestId: input.requestId,
      employeeId: input.employeeId,
      title: input.title,
      department: input.department,
      costCenter: input.costCenter,
      systemName: input.systemName,
      targetEntitlement: input.entitlementKey,
      justification: input.justification,
      currentEntitlements,
      recommendation,
    };
  }
}
