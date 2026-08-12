import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AccessRequest, User } from '@prisma/client';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { DEMO_PRINCIPALS } from '../auth/demo-auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { AccessRecommendationService } from './access-recommendation.service';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { HitlAccessRequestsService } from './hitl-access-requests.service';
import { MockDownstreamRateLimitError } from './mock-downstream.service';
import { SEED_REQUESTOR_EMPLOYEE_ID, SEED_REQUESTOR_USER_ID } from './seed-ids';

const hitlCreateDto = {
  title: 'Data Analyst',
  department: 'Finance Analytics',
  costCenter: 'CC-FIN-07',
  systemName: 'DATA_WAREHOUSE',
  entitlementKey: 'prod-postgres-admin',
  justification: 'Need admin for incident response',
};

function pendingRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    requestId: 'req-1',
    employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
    systemName: 'DATA_WAREHOUSE',
    targetEntitlement: 'FIN_DATASET_READ',
    status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
    ...overrides,
  } as AccessRequest;
}

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

  const mockEntitlementRepository: jest.Mocked<
    Pick<EntitlementRepository, 'findByUserId' | 'findByUserIds'>
  > = {
    findByUserId: jest.fn(),
    findByUserIds: jest.fn(),
  };

  const mockUserRepository: jest.Mocked<Pick<UserRepository, 'findByEmployeeIdHashes'>> = {
    findByEmployeeIdHashes: jest.fn(),
  };

  const mockAccessRecommendationService: jest.Mocked<
    Pick<AccessRecommendationService, 'createWithRecommendation'>
  > = {
    createWithRecommendation: jest.fn(),
  };

  const mockEntitlementExecutionService: jest.Mocked<
    Pick<EntitlementExecutionService, 'grant' | 'revoke'>
  > = {
    grant: jest.fn(),
    revoke: jest.fn(),
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
      mockUserRepository as unknown as UserRepository,
      mockAccessRecommendationService as unknown as AccessRecommendationService,
      mockEntitlementExecutionService as unknown as EntitlementExecutionService,
      mockAuditLogService as unknown as AuditLogService,
    );

    mockUserRepository.findByEmployeeIdHashes.mockResolvedValue([
      {
        id: SEED_REQUESTOR_USER_ID,
        employeeIdHash: hashIdentifier(SEED_REQUESTOR_EMPLOYEE_ID),
      } as User,
    ]);
    mockEntitlementRepository.findByUserIds.mockResolvedValue([
      {
        id: 'ent-1',
        userId: SEED_REQUESTOR_USER_ID,
        resourceName: 'payroll-api',
        permissionLevel: 'read',
        expiresAt: null,
      },
    ]);
  });

  it('delegates HITL create to the shared recommendation orchestrator', async () => {
    mockAccessRecommendationService.createWithRecommendation.mockResolvedValue({
      requestId: 'req-1',
      employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
      title: hitlCreateDto.title,
      department: hitlCreateDto.department,
      costCenter: hitlCreateDto.costCenter,
      systemName: hitlCreateDto.systemName,
      targetEntitlement: hitlCreateDto.entitlementKey,
      justification: hitlCreateDto.justification,
      currentEntitlements: ['payroll-api:read'],
      recommendation: {
        decision: 'DENY',
        rationale: 'Missing change ticket.',
        confidenceScore: 0.9,
        policyCitations: [],
      },
    });

    const result = await service.createWithRecommendation(hitlCreateDto, DEMO_PRINCIPALS.user);

    expect(result.employeeId).toBe(SEED_REQUESTOR_EMPLOYEE_ID);
    expect(result.targetEntitlement).toBe('prod-postgres-admin');
    expect(mockAccessRecommendationService.createWithRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: DEMO_PRINCIPALS.user.employeeId,
        actorUserId: DEMO_PRINCIPALS.user.userId,
        entitlementUserId: DEMO_PRINCIPALS.user.userId,
        title: hitlCreateDto.title,
        department: hitlCreateDto.department,
        costCenter: hitlCreateDto.costCenter,
        systemName: hitlCreateDto.systemName,
        entitlementKey: hitlCreateDto.entitlementKey,
        justification: hitlCreateDto.justification,
      }),
    );
  });

  it('grants the entitlement before marking a pending request approved', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);
    mockEntitlementExecutionService.grant.mockResolvedValue({
      status: 'granted',
      requestId: 'req-1',
      userId: SEED_REQUESTOR_USER_ID,
      resourceName: 'DATA_WAREHOUSE',
      permissionLevel: 'FIN_DATASET_READ',
    });

    const result = await service.approve('req-1', DEMO_PRINCIPALS.admin);

    expect(result).toEqual({ requestId: 'req-1', status: 'approved' });
    expect(mockEntitlementExecutionService.grant).toHaveBeenCalledWith({
      requestId: 'req-1',
      employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
      actorUserId: DEMO_PRINCIPALS.admin.userId,
      systemName: 'DATA_WAREHOUSE',
      targetEntitlement: 'FIN_DATASET_READ',
    });
    expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.APPROVED,
      decidedByAdminId: DEMO_PRINCIPALS.admin.actorId,
    });
  });

  it('does not mark decided when mock downstream rate-limits the grant', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
    mockEntitlementExecutionService.grant.mockRejectedValue(new MockDownstreamRateLimitError());

    await expect(service.approve('req-1', DEMO_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      MockDownstreamRateLimitError,
    );
    expect(mockAccessRequestRepository.markDecided).not.toHaveBeenCalled();
  });

  it('escalates a pending request without granting or revoking', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    const result = await service.escalate('req-1', DEMO_PRINCIPALS.admin);

    expect(result).toEqual({ requestId: 'req-1', status: 'escalated' });
    expect(mockEntitlementExecutionService.grant).not.toHaveBeenCalled();
    expect(mockEntitlementExecutionService.revoke).not.toHaveBeenCalled();
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

  it('revokes the grant when overriding an approval to deny', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(
      pendingRequest({ status: ACCESS_REQUEST_STATUS.APPROVED }),
    );
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);
    mockEntitlementExecutionService.revoke.mockResolvedValue(undefined);

    const result = await service.deny('req-1', DEMO_PRINCIPALS.admin);

    expect(result).toEqual({ requestId: 'req-1', status: 'denied' });
    expect(mockEntitlementExecutionService.revoke).toHaveBeenCalledTimes(1);
    expect(mockEntitlementExecutionService.grant).not.toHaveBeenCalled();
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
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(
      pendingRequest({ status: ACCESS_REQUEST_STATUS.DENIED }),
    );

    await expect(service.deny('req-1', DEMO_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockEntitlementExecutionService.revoke).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deciding a missing request', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(null);

    await expect(service.approve('missing', DEMO_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists decided history items with entitlements for the request employee', async () => {
    const decidedAt = new Date('2026-08-01T12:00:00.000Z');
    mockAccessRequestRepository.findDecided.mockResolvedValue([
      {
        requestId: 'req-hist-1',
        employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: 'DATA_WAREHOUSE',
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

    expect(mockUserRepository.findByEmployeeIdHashes).toHaveBeenCalledWith([
      hashIdentifier(SEED_REQUESTOR_EMPLOYEE_ID),
    ]);
    expect(mockEntitlementRepository.findByUserIds).toHaveBeenCalledWith([SEED_REQUESTOR_USER_ID]);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      requestId: 'req-hist-1',
      title: 'Data Analyst',
      systemName: 'DATA_WAREHOUSE',
      status: 'APPROVED',
      currentEntitlements: ['payroll-api:read'],
      decidedAt: decidedAt.toISOString(),
      decidedByAdminId: DEMO_PRINCIPALS.admin.actorId,
    });
  });
});
