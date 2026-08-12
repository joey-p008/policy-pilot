import { NotFoundException } from '@nestjs/common';

import { hashIdentifier } from '../../common/crypto/hash-identifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EntitlementRepository } from '../database/repositories/entitlement.repository';
import { UserRepository } from '../database/repositories/user.repository';
import { IdempotencyService, IdempotentResult } from '../idempotency/idempotency.service';
import {
  ACCESS_GRANT_IDEMPOTENCY_ENDPOINT,
  buildGrantIdempotencyRequestId,
} from './access-requests.constants';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { MockDownstreamRateLimitError, MockDownstreamService } from './mock-downstream.service';

const ACTOR_USER_ID = 'f1c2a3b4-5d6e-4789-a012-3456789abcde';
const USER_ID = '8d0504b3-0e57-454a-833f-1c22aec8089b';
const EMPLOYEE_ID = 'E-MOCK-042';

const grantInput = {
  requestId: 'req-grant-1',
  employeeId: EMPLOYEE_ID,
  actorUserId: ACTOR_USER_ID,
  systemName: 'DATA_WAREHOUSE',
  targetEntitlement: 'FIN_DATASET_READ',
};

describe('EntitlementExecutionService', () => {
  const findByEmployeeIdHash = jest.fn();
  const upsertByUserResourcePermission = jest.fn();
  const deleteByUserResourcePermission = jest.fn();
  const invoke = jest.fn<Promise<void>, []>();
  const executeIdempotent = jest.fn();
  const append = jest.fn();

  const service = new EntitlementExecutionService(
    { findByEmployeeIdHash } as unknown as UserRepository,
    {
      upsertByUserResourcePermission,
      deleteByUserResourcePermission,
    } as unknown as EntitlementRepository,
    { invoke } as unknown as MockDownstreamService,
    { executeIdempotent } as unknown as IdempotencyService,
    { append } as unknown as AuditLogService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    findByEmployeeIdHash.mockResolvedValue({
      id: USER_ID,
      employeeIdHash: hashIdentifier(EMPLOYEE_ID),
    });
    upsertByUserResourcePermission.mockResolvedValue({
      id: 'ent-1',
      userId: USER_ID,
      resourceName: grantInput.systemName,
      permissionLevel: grantInput.targetEntitlement,
      expiresAt: null,
    });
    deleteByUserResourcePermission.mockResolvedValue(1);
    invoke.mockResolvedValue(undefined);
    append.mockResolvedValue({});
    executeIdempotent.mockImplementation(async (params) => {
      const response = await params.execute();
      return { replayed: false, response } satisfies IdempotentResult<unknown>;
    });
  });

  it('upserts the entitlement, invokes mock downstream, and audits ACCESS_GRANTED', async () => {
    const result = await service.grant(grantInput);

    expect(findByEmployeeIdHash).toHaveBeenCalledWith(hashIdentifier(EMPLOYEE_ID));
    expect(upsertByUserResourcePermission).toHaveBeenCalledWith({
      userId: USER_ID,
      resourceName: 'DATA_WAREHOUSE',
      permissionLevel: 'FIN_DATASET_READ',
    });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-grant-1',
        actorId: ACTOR_USER_ID,
        action: 'ACCESS_GRANTED',
      }),
    );
    expect(executeIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: buildGrantIdempotencyRequestId('req-grant-1'),
        endpoint: ACCESS_GRANT_IDEMPOTENCY_ENDPOINT,
      }),
    );
    expect(result).toEqual({
      status: 'granted',
      requestId: 'req-grant-1',
      userId: USER_ID,
      resourceName: 'DATA_WAREHOUSE',
      permissionLevel: 'FIN_DATASET_READ',
    });
  });

  it('skips downstream invoke when the grant idempotency key is replayed', async () => {
    executeIdempotent.mockResolvedValue({
      replayed: true,
      response: {
        status: 'granted',
        requestId: 'req-grant-1',
        userId: USER_ID,
        resourceName: 'DATA_WAREHOUSE',
        permissionLevel: 'FIN_DATASET_READ',
      },
    });

    const result = await service.grant(grantInput);

    expect(result.status).toBe('granted');
    expect(upsertByUserResourcePermission).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });

  it('propagates mock downstream rate-limit errors without storing a grant', async () => {
    invoke.mockRejectedValue(new MockDownstreamRateLimitError());

    await expect(service.grant(grantInput)).rejects.toBeInstanceOf(MockDownstreamRateLimitError);
    expect(upsertByUserResourcePermission).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when the employee has no user row', async () => {
    findByEmployeeIdHash.mockResolvedValue(null);

    await expect(service.grant(grantInput)).rejects.toBeInstanceOf(NotFoundException);
    expect(executeIdempotent).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('deletes the entitlement and audits ACCESS_REVOKED', async () => {
    await service.revoke(grantInput);

    expect(deleteByUserResourcePermission).toHaveBeenCalledWith({
      userId: USER_ID,
      resourceName: 'DATA_WAREHOUSE',
      permissionLevel: 'FIN_DATASET_READ',
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACCESS_REVOKED',
      }),
    );
  });

  it('does not audit when revoke finds no entitlement row', async () => {
    deleteByUserResourcePermission.mockResolvedValue(0);

    await service.revoke(grantInput);

    expect(append).not.toHaveBeenCalled();
  });
});
