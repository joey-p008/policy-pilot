import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AccessRequest } from '@prisma/client';

import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import { DEMO_PRINCIPALS } from '../auth/demo-auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { HitlAccessRequestsService } from './hitl-access-requests.service';
import { SEED_REQUESTOR_EMPLOYEE_ID } from './seed-ids';

describe('HitlAccessRequestsService', () => {
  const mockAccessRequestRepository: jest.Mocked<
    Pick<
      AccessRequestRepository,
      'create' | 'findByRequestId' | 'findPendingReview' | 'findDecided' | 'markDecided'
    >
  > = {
    create: jest.fn(),
    findByRequestId: jest.fn(),
    findPendingReview: jest.fn(),
    findDecided: jest.fn(),
    markDecided: jest.fn(),
  };

  const mockEntitlementRepository: jest.Mocked<Pick<EntitlementRepository, 'findByUserId'>> = {
    findByUserId: jest.fn(),
  };

  const mockRetrievalService: jest.Mocked<Pick<RetrievalService, 'retrieve'>> = {
    retrieve: jest.fn(),
  };

  const mockDecisionEngineService: jest.Mocked<Pick<DecisionEngineService, 'decide'>> = {
    decide: jest.fn(),
  };

  const mockAuditLogService: jest.Mocked<Pick<AuditLogService, 'append'>> = {
    append: jest.fn(),
  };

  let service: HitlAccessRequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HitlAccessRequestsService(
      mockAccessRequestRepository as unknown as AccessRequestRepository,
      mockEntitlementRepository as unknown as EntitlementRepository,
      mockRetrievalService as unknown as RetrievalService,
      mockDecisionEngineService as unknown as DecisionEngineService,
      mockAuditLogService as unknown as AuditLogService,
    );

    mockEntitlementRepository.findByUserId.mockResolvedValue([
      {
        id: 'ent-1',
        userId: 'user-a',
        resourceName: 'payroll-api',
        permissionLevel: 'read',
        expiresAt: null,
      },
    ]);
  });

  it('creates a pending request with RAG recommendation mapped to camelCase', async () => {
    mockRetrievalService.retrieve.mockResolvedValue([
      {
        document_id: 'POL-2026-02',
        page_number: 4,
        section_title: 'Privileged Access',
        content: 'Production admin requires an approved change ticket.',
      },
    ]);
    mockDecisionEngineService.decide.mockResolvedValue({
      decision: 'DENY',
      rationale: 'Missing change ticket.',
      confidence_score: 0.9,
      policy_citations: [
        {
          document_id: 'POL-2026-02',
          page_number: 4,
          section_title: 'Privileged Access',
        },
      ],
    });
    mockAccessRequestRepository.create.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    const result = await service.createWithRecommendation(
      {
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Need admin for incident response',
      },
      DEMO_PRINCIPALS.user,
    );

    expect(result.employeeId).toBe(SEED_REQUESTOR_EMPLOYEE_ID);
    expect(result.justification).toBe('Need admin for incident response');
    expect(result.currentEntitlements).toEqual(['payroll-api:read']);
    expect(result.recommendation).toEqual({
      decision: 'DENY',
      rationale: 'Missing change ticket.',
      confidenceScore: 0.9,
      policyCitations: [
        {
          documentId: 'POL-2026-02',
          pageNumber: 4,
          sectionTitle: 'Privileged Access',
          content: 'Production admin requires an approved change ticket.',
        },
      ],
    });
    expect(mockEntitlementRepository.findByUserId).toHaveBeenCalledWith(
      DEMO_PRINCIPALS.user.userId,
    );
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECOMMENDATION_CREATED',
        actorId: DEMO_PRINCIPALS.user.userId,
      }),
    );
  });

  it('escalates a pending request and returns escalated status', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
    } as AccessRequest);
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    const result = await service.escalate('req-1', DEMO_PRINCIPALS.admin);

    expect(result).toEqual({ requestId: 'req-1', status: 'escalated' });
    expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.ESCALATED,
      decidedByAdminId: DEMO_PRINCIPALS.admin.actorId,
    });
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HUMAN_ESCALATED',
      }),
    );
  });

  it('overrides a decided request and audits HUMAN_DECISION_OVERRIDE', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.APPROVED,
    } as AccessRequest);
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    const result = await service.deny('req-1', DEMO_PRINCIPALS.admin);

    expect(result).toEqual({ requestId: 'req-1', status: 'denied' });
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HUMAN_DECISION_OVERRIDE',
        previousState: { status: ACCESS_REQUEST_STATUS.APPROVED },
        newState: {
          status: ACCESS_REQUEST_STATUS.DENIED,
          actor_id: DEMO_PRINCIPALS.admin.actorId,
        },
      }),
    );
  });

  it('throws ConflictException when overriding to the same status', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.DENIED,
    } as AccessRequest);

    await expect(service.deny('req-1', DEMO_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFoundException when deciding a missing request', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(null);

    await expect(service.approve('missing', DEMO_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists decided history items newest-first from repository', async () => {
    const decidedAt = new Date('2026-08-01T12:00:00.000Z');
    mockAccessRequestRepository.findDecided.mockResolvedValue([
      {
        requestId: 'req-hist-1',
        employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Need access',
        status: ACCESS_REQUEST_STATUS.APPROVED,
        recommendationJson: {
          decision: 'APPROVE',
          rationale: 'Within policy',
          confidenceScore: 0.8,
          policyCitations: [],
        },
        createdAt: decidedAt,
        decidedAt,
        decidedByAdminId: DEMO_PRINCIPALS.admin.actorId,
      } as unknown as AccessRequest,
    ]);

    const history = await service.listHistory();

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      requestId: 'req-hist-1',
      status: 'APPROVED',
      decidedAt: decidedAt.toISOString(),
      decidedByAdminId: DEMO_PRINCIPALS.admin.actorId,
    });
  });
});
