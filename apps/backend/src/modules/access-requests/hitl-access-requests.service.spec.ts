import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AccessRequest, User } from '@prisma/client';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AUTH_PRINCIPALS } from '../auth/auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  AccessRequestRepository,
  PROVISIONING_STATUS,
} from '../database/repositories/access-request.repository';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { AccessGrantQueueService } from './access-grant-queue.service';
import { AccessRecommendationService } from './access-recommendation.service';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { HitlAccessRequestsService } from './hitl-access-requests.service';
import { SEED_REQUESTOR_EMPLOYEE_ID, SEED_REQUESTOR_USER_ID } from './seed-ids';

const hitlCreateDto = {
  title: 'Data Analyst',
  department: 'Finance Analytics',
  costCenter: 'CC-FIN-07',
  systemName: 'DATA_WAREHOUSE',
  entitlementKey: 'prod-postgres-admin',
  justification: 'Need admin for incident response',
};

const executionInput = {
  requestId: 'req-1',
  employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
  actorUserId: AUTH_PRINCIPALS.admin.userId,
  systemName: 'DATA_WAREHOUSE',
  targetEntitlement: 'FIN_DATASET_READ',
};

function pendingRequest(overrides: Partial<AccessRequest> = {}): AccessRequest {
  return {
    requestId: 'req-1',
    employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
    systemName: 'DATA_WAREHOUSE',
    targetEntitlement: 'FIN_DATASET_READ',
    status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
    provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
    ...overrides,
  } as AccessRequest;
}

describe('HitlAccessRequestsService', () => {
  const mockAccessRequestRepository: jest.Mocked<
    Pick<
      AccessRequestRepository,
      | 'create'
      | 'findByRequestId'
      | 'findPendingReview'
      | 'findDecided'
      | 'markDecided'
      | 'updateProvisioningStatus'
    >
  > = {
    create: jest.fn(),
    findByRequestId: jest.fn(),
    findPendingReview: jest.fn(),
    findDecided: jest.fn(),
    markDecided: jest.fn(),
    updateProvisioningStatus: jest.fn(),
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

  const mockAccessGrantQueueService: jest.Mocked<
    Pick<AccessGrantQueueService, 'enqueueGrant' | 'cancelQueuedGrant' | 'pauseForRateLimit'>
  > = {
    enqueueGrant: jest.fn(),
    cancelQueuedGrant: jest.fn(),
    pauseForRateLimit: jest.fn(),
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
      mockAccessGrantQueueService as unknown as AccessGrantQueueService,
      mockAuditLogService as unknown as AuditLogService,
    );

    mockAccessGrantQueueService.enqueueGrant.mockResolvedValue(undefined);
    mockAccessGrantQueueService.cancelQueuedGrant.mockResolvedValue(true);
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

    const result = await service.createWithRecommendation(hitlCreateDto, AUTH_PRINCIPALS.user);

    expect(result.employeeId).toBe(SEED_REQUESTOR_EMPLOYEE_ID);
    expect(result.targetEntitlement).toBe('prod-postgres-admin');
    expect(mockAccessRecommendationService.createWithRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: AUTH_PRINCIPALS.user.employeeId,
        actorUserId: AUTH_PRINCIPALS.user.userId,
        entitlementUserId: AUTH_PRINCIPALS.user.userId,
        title: hitlCreateDto.title,
        department: hitlCreateDto.department,
        costCenter: hitlCreateDto.costCenter,
        systemName: hitlCreateDto.systemName,
        entitlementKey: hitlCreateDto.entitlementKey,
        justification: hitlCreateDto.justification,
      }),
    );
  });

  describe('approve', () => {
    beforeEach(() => {
      mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
      mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
      mockAuditLogService.append.mockResolvedValue({} as never);
    });

    it('queues the grant instead of calling the downstream inline', async () => {
      const result = await service.approve('req-1', AUTH_PRINCIPALS.admin);

      expect(result).toEqual({
        requestId: 'req-1',
        status: 'approved',
        provisioningStatus: PROVISIONING_STATUS.QUEUED,
      });
      expect(mockAccessGrantQueueService.enqueueGrant).toHaveBeenCalledWith(executionInput);
      expect(mockEntitlementExecutionService.grant).not.toHaveBeenCalled();
    });

    it('records the request as APPROVED and QUEUED', async () => {
      await service.approve('req-1', AUTH_PRINCIPALS.admin);

      expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
        requestId: 'req-1',
        status: ACCESS_REQUEST_STATUS.APPROVED,
        provisioningStatus: PROVISIONING_STATUS.QUEUED,
        decidedByAdminId: AUTH_PRINCIPALS.admin.actorId,
      });
    });

    it('persists the decision before enqueuing so the worker cannot race the write', async () => {
      await service.approve('req-1', AUTH_PRINCIPALS.admin);

      expect(mockAccessRequestRepository.markDecided.mock.invocationCallOrder[0]).toBeLessThan(
        mockAccessGrantQueueService.enqueueGrant.mock.invocationCallOrder[0],
      );
    });

    it('audits the human approval with the queued provisioning state', async () => {
      await service.approve('req-1', AUTH_PRINCIPALS.admin);

      expect(mockAuditLogService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HUMAN_APPROVED',
          newState: {
            status: ACCESS_REQUEST_STATUS.APPROVED,
            actor_id: AUTH_PRINCIPALS.admin.actorId,
            provisioning_status: PROVISIONING_STATUS.QUEUED,
          },
        }),
      );
    });
  });

  it('escalates a pending request without granting or revoking', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    const result = await service.escalate('req-1', AUTH_PRINCIPALS.admin);

    expect(result).toEqual({
      requestId: 'req-1',
      status: 'escalated',
      provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
    });
    expect(mockAccessGrantQueueService.enqueueGrant).not.toHaveBeenCalled();
    expect(mockEntitlementExecutionService.revoke).not.toHaveBeenCalled();
    expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
      requestId: 'req-1',
      status: ACCESS_REQUEST_STATUS.ESCALATED,
      provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
      decidedByAdminId: AUTH_PRINCIPALS.admin.actorId,
    });
    expect(mockAuditLogService.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HUMAN_ESCALATED',
      }),
    );
  });

  it('does not touch the grant queue when denying a request that was never approved', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(pendingRequest());
    mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
    mockAuditLogService.append.mockResolvedValue({} as never);

    await service.deny('req-1', AUTH_PRINCIPALS.admin);

    expect(mockAccessGrantQueueService.cancelQueuedGrant).not.toHaveBeenCalled();
    expect(mockEntitlementExecutionService.revoke).not.toHaveBeenCalled();
  });

  describe('overriding an approval', () => {
    beforeEach(() => {
      mockAccessRequestRepository.findByRequestId.mockResolvedValue(
        pendingRequest({
          status: ACCESS_REQUEST_STATUS.APPROVED,
          provisioningStatus: PROVISIONING_STATUS.QUEUED,
        }),
      );
      mockAccessRequestRepository.markDecided.mockResolvedValue({} as AccessRequest);
      mockAuditLogService.append.mockResolvedValue({} as never);
      mockEntitlementExecutionService.revoke.mockResolvedValue(undefined);
    });

    it('withdraws a still-queued grant before revoking', async () => {
      const result = await service.deny('req-1', AUTH_PRINCIPALS.admin);

      expect(result).toEqual({
        requestId: 'req-1',
        status: 'denied',
        provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
      });
      expect(mockAccessGrantQueueService.cancelQueuedGrant).toHaveBeenCalledWith('req-1');
      expect(mockEntitlementExecutionService.revoke).toHaveBeenCalledTimes(1);
      expect(
        mockAccessGrantQueueService.cancelQueuedGrant.mock.invocationCallOrder[0],
      ).toBeLessThan(mockEntitlementExecutionService.revoke.mock.invocationCallOrder[0]);
    });

    it('still revokes when the grant had already left the queue', async () => {
      mockAccessGrantQueueService.cancelQueuedGrant.mockResolvedValue(false);

      await service.deny('req-1', AUTH_PRINCIPALS.admin);

      expect(mockEntitlementExecutionService.revoke).toHaveBeenCalledTimes(1);
    });

    it('clears the provisioning state and audits the override', async () => {
      await service.deny('req-1', AUTH_PRINCIPALS.admin);

      expect(mockAccessRequestRepository.markDecided).toHaveBeenCalledWith({
        requestId: 'req-1',
        status: ACCESS_REQUEST_STATUS.DENIED,
        provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
        decidedByAdminId: AUTH_PRINCIPALS.admin.actorId,
      });
      expect(mockAuditLogService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'HUMAN_DECISION_OVERRIDE',
          previousState: { status: ACCESS_REQUEST_STATUS.APPROVED },
          newState: {
            status: ACCESS_REQUEST_STATUS.DENIED,
            actor_id: AUTH_PRINCIPALS.admin.actorId,
            provisioning_status: PROVISIONING_STATUS.NOT_APPLICABLE,
          },
        }),
      );
    });

    it('re-queues the grant when overriding an escalation back to approved', async () => {
      mockAccessRequestRepository.findByRequestId.mockResolvedValue(
        pendingRequest({ status: ACCESS_REQUEST_STATUS.ESCALATED }),
      );

      await service.approve('req-1', AUTH_PRINCIPALS.admin);

      expect(mockAccessGrantQueueService.enqueueGrant).toHaveBeenCalledWith(executionInput);
      expect(mockAccessGrantQueueService.cancelQueuedGrant).not.toHaveBeenCalled();
    });
  });

  it('throws ConflictException when overriding to the same status', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(
      pendingRequest({ status: ACCESS_REQUEST_STATUS.DENIED }),
    );

    await expect(service.deny('req-1', AUTH_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(mockEntitlementExecutionService.revoke).not.toHaveBeenCalled();
    expect(mockAccessGrantQueueService.enqueueGrant).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deciding a missing request', async () => {
    mockAccessRequestRepository.findByRequestId.mockResolvedValue(null);

    await expect(service.approve('missing', AUTH_PRINCIPALS.admin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(mockAccessGrantQueueService.enqueueGrant).not.toHaveBeenCalled();
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
        provisioningStatus: PROVISIONING_STATUS.QUEUED,
        recommendationJson: {
          decision: 'APPROVE',
          rationale: 'Within policy',
          confidenceScore: 0.8,
          policyCitations: [],
        },
        createdAt: decidedAt,
        decidedAt,
        decidedByAdminId: AUTH_PRINCIPALS.admin.actorId,
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
      provisioningStatus: PROVISIONING_STATUS.QUEUED,
      currentEntitlements: ['payroll-api:read'],
      decidedAt: decidedAt.toISOString(),
      decidedByAdminId: AUTH_PRINCIPALS.admin.actorId,
    });
  });

  it('rejects a history row carrying an unrecognised provisioning status', async () => {
    mockAccessRequestRepository.findDecided.mockResolvedValue([
      {
        requestId: 'req-hist-2',
        employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
        status: ACCESS_REQUEST_STATUS.APPROVED,
        provisioningStatus: 'HALF_GRANTED',
        recommendationJson: {
          decision: 'APPROVE',
          rationale: 'Within policy',
          confidenceScore: 0.8,
          policyCitations: [],
        },
        createdAt: new Date(),
        decidedAt: new Date(),
        decidedByAdminId: null,
      } as unknown as AccessRequest,
    ]);

    await expect(service.listHistory()).rejects.toThrow(/Unexpected provisioning status/);
  });
});
