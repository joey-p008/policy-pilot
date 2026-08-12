import type { AccessRequest, User } from '@prisma/client';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DecisionEngineService } from '../ai/decision-engine.service';
import { RetrievalService } from '../ai/retrieval.service';
import { AccessRequestRepository } from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { AccessRecommendationService } from './access-recommendation.service';
import type { AccessRequestDto } from './dto/access-requests.dto';
import { SEED_SYSTEM_INGEST_USER_ID } from './seed-ids';

const webhookDto: AccessRequestDto = {
  request_id: 'req_access_2026_44821',
  employee_id: 'EMP-52190',
  request_type: 'GRANT_ENTITLEMENT',
  timestamp: '2026-07-01T09:15:00Z',
  requester: {
    title: 'Data Analyst',
    department: 'Finance Analytics',
    cost_center: 'CC-FIN-07',
  },
  target: {
    system_name: 'DATA_WAREHOUSE',
    entitlement_key: 'FIN_DATASET_EDIT',
    justification: 'Need to build quarterly revenue models.',
  },
};

describe('AccessRecommendationService', () => {
  const mockAccessRequestRepository: jest.Mocked<
    Pick<AccessRequestRepository, 'create' | 'findByRequestId'>
  > = {
    create: jest.fn(),
    findByRequestId: jest.fn(),
  };

  const mockEntitlementRepository: jest.Mocked<Pick<EntitlementRepository, 'findByUserId'>> = {
    findByUserId: jest.fn(),
  };

  const mockUserRepository: jest.Mocked<Pick<UserRepository, 'findByEmployeeIdHash'>> = {
    findByEmployeeIdHash: jest.fn(),
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

  let service: AccessRecommendationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessRecommendationService(
      mockAccessRequestRepository as unknown as AccessRequestRepository,
      mockEntitlementRepository as unknown as EntitlementRepository,
      mockUserRepository as unknown as UserRepository,
      mockRetrievalService as unknown as RetrievalService,
      mockDecisionEngineService as unknown as DecisionEngineService,
      mockAuditLogService as unknown as AuditLogService,
    );

    mockAccessRequestRepository.findByRequestId.mockResolvedValue(null);
    mockEntitlementRepository.findByUserId.mockResolvedValue([
      {
        id: 'ent-1',
        userId: 'user-a',
        resourceName: 'payroll-api',
        permissionLevel: 'read',
        expiresAt: null,
      },
    ]);
    mockRetrievalService.retrieve.mockResolvedValue([
      {
        document_id: 'POL-2026-01-DGW',
        page_number: 1,
        section_title: 'CLAUSE 3.0',
        content: 'Baseline read access for CC-FIN-07.',
      },
    ]);
    mockDecisionEngineService.decide.mockResolvedValue({
      decision: 'APPROVE',
      rationale: 'Cost center matches baseline read policy.',
      confidence_score: 0.9,
      policy_citations: [
        {
          document_id: 'POL-2026-01-DGW',
          page_number: 1,
          section_title: 'CLAUSE 3.0',
        },
      ],
    });
    mockAccessRequestRepository.create.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);
  });

  it('passes the six ticket fields and mapped entitlements into retrieval and decide', async () => {
    const result = await service.createWithRecommendation({
      requestId: 'req-1',
      employeeId: 'E-MOCK-042',
      actorUserId: 'user-a',
      entitlementUserId: 'user-a',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      systemName: 'DATA_WAREHOUSE',
      entitlementKey: 'FIN_DATASET_EDIT',
      justification: 'Need to build quarterly revenue models.',
    });

    expect(mockRetrievalService.retrieve).toHaveBeenCalledWith({
      requestId: 'req-1',
      targetEntitlement: 'FIN_DATASET_EDIT',
      justification: 'Need to build quarterly revenue models.',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      targetResource: 'DATA_WAREHOUSE',
      currentEntitlements: ['payroll-api:read'],
    });
    expect(mockDecisionEngineService.decide).toHaveBeenCalledWith({
      request: {
        requestId: 'req-1',
        targetEntitlement: 'FIN_DATASET_EDIT',
        justification: 'Need to build quarterly revenue models.',
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        targetResource: 'DATA_WAREHOUSE',
        currentEntitlements: ['payroll-api:read'],
      },
      policyChunks: expect.any(Array),
    });
    expect(result.systemName).toBe('DATA_WAREHOUSE');
    expect(result.targetEntitlement).toBe('FIN_DATASET_EDIT');
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RECOMMENDATION_CREATED',
        newState: expect.objectContaining({
          employee_id: 'E-MOCK-042',
          cost_center: 'CC-FIN-07',
        }),
      }),
    );
  });

  it('looks up webhook entitlements by hashed employee_id and uses the system ingest actor when missing', async () => {
    mockUserRepository.findByEmployeeIdHash.mockResolvedValue(null);
    mockEntitlementRepository.findByUserId.mockResolvedValue([]);

    await service.createFromWebhook(webhookDto);

    expect(mockUserRepository.findByEmployeeIdHash).toHaveBeenCalledWith(
      hashIdentifier('EMP-52190'),
    );
    expect(mockEntitlementRepository.findByUserId).not.toHaveBeenCalled();
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: SEED_SYSTEM_INGEST_USER_ID,
      }),
    );
  });

  it('uses the matched user for webhook entitlement lookup and audit actor', async () => {
    mockUserRepository.findByEmployeeIdHash.mockResolvedValue({
      id: 'user-a',
    } as User);

    await service.createFromWebhook(webhookDto);

    expect(mockEntitlementRepository.findByUserId).toHaveBeenCalledWith('user-a');
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'user-a',
      }),
    );
  });

  it('returns the existing request without re-running RAG when request_id already exists', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue({
      requestId: 'req-1',
      employeeId: 'E-MOCK-042',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      systemName: 'DATA_WAREHOUSE',
      targetEntitlement: 'FIN_DATASET_EDIT',
      justification: 'Need to build quarterly revenue models.',
      recommendationJson: {
        decision: 'APPROVE',
        rationale: 'Existing',
        confidenceScore: 0.8,
        policyCitations: [],
      },
    } as unknown as AccessRequest);

    const result = await service.createWithRecommendation({
      requestId: 'req-1',
      employeeId: 'E-MOCK-042',
      actorUserId: 'user-a',
      entitlementUserId: 'user-a',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      systemName: 'DATA_WAREHOUSE',
      entitlementKey: 'FIN_DATASET_EDIT',
      justification: 'Need to build quarterly revenue models.',
    });

    expect(mockRetrievalService.retrieve).not.toHaveBeenCalled();
    expect(mockDecisionEngineService.decide).not.toHaveBeenCalled();
    expect(mockAccessRequestRepository.create).not.toHaveBeenCalled();
    expect(result.recommendation.decision).toBe('APPROVE');
  });
});
