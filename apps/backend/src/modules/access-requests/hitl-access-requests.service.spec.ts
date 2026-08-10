import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AccessRequest } from '@prisma/client';

import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { HitlAccessRequestsService } from './hitl-access-requests.service';
import { SEED_HITL_ADMIN_API_ID, SEED_REQUESTOR_EMPLOYEE_ID } from './seed-ids';

describe('HitlAccessRequestsService', () => {
  const mockAccessRequestRepository: jest.Mocked<
    Pick<
      AccessRequestRepository,
      'create' | 'findByRequestId' | 'findPendingReview' | 'markDecided'
    >
  > = {
    create: jest.fn(),
    findByRequestId: jest.fn(),
    findPendingReview: jest.fn(),
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

    const result = await service.createWithRecommendation({
      targetEntitlement: 'prod-postgres-admin',
      justification: 'Need admin for incident response',
    });

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
    expect(mockRetrievalService.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Need admin for incident response',
      }),
    );
    expect(mockDecisionEngineService.decide).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          justification: 'Need admin for incident response',
        }),
      }),
    );
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECOMMENDATION_CREATED',
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

    const result = await service.escalate('req-1', SEED_HITL_ADMIN_API_ID);

    expect(result).toEqual({ requestId: 'req-1', status: 'escalated' });
    expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.ESCALATED,
      decidedByAdminId: SEED_HITL_ADMIN_API_ID,
    });
  });

  it('throws NotFoundException when deciding a missing request', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(null);

    await expect(service.approve('missing', SEED_HITL_ADMIN_API_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws ConflictException when deciding a non-pending request', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.APPROVED,
    } as AccessRequest);

    await expect(service.deny('req-1', SEED_HITL_ADMIN_API_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
