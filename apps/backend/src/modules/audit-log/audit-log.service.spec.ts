import { AccessAuditLog } from '@prisma/client';
import { ZodError } from 'zod';

import { AccessAuditLogRepository } from '../database/repositories/access-audit-log.repository';
import { AuditLogService } from './audit-log.service';

const RAW_EMPLOYEE_ID = 'E1234567';
const RAW_COST_CENTER = 'CC-9001';
const ACTOR_ID = '041aa56a-3752-44ec-a157-436d4f30328f';

describe('AuditLogService', () => {
  const create = jest.fn();
  const repository = {
    create,
  } as unknown as AccessAuditLogRepository;

  const service = new AuditLogService(repository);

  beforeEach(() => {
    create.mockReset();
  });

  it('appends an audit log row successfully', async () => {
    const createdRow = {
      id: '82584cee-6bae-40dd-b620-e16c4613e06d',
      requestId: 'req-1',
      actorId: ACTOR_ID,
      action: 'HUMAN_APPROVED',
      previousState: { status: 'PENDING' },
      newState: { status: 'APPROVED' },
      timestamp: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies AccessAuditLog;

    create.mockResolvedValue(createdRow);

    const result = await service.append({
      requestId: 'req-1',
      actorId: ACTOR_ID,
      action: 'HUMAN_APPROVED',
      previousState: { status: 'PENDING' },
      newState: { status: 'APPROVED' },
    });

    expect(result).toEqual(createdRow);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('scrubs PII in previousState and newState before persistence', async () => {
    create.mockResolvedValue({
      id: '82584cee-6bae-40dd-b620-e16c4613e06d',
      requestId: 'req-pii',
      actorId: ACTOR_ID,
      action: 'RECOMMENDATION_CREATED',
      previousState: {},
      newState: {},
      timestamp: new Date(),
    });

    await service.append({
      requestId: 'req-pii',
      actorId: ACTOR_ID,
      action: 'RECOMMENDATION_CREATED',
      previousState: {
        employee_id: RAW_EMPLOYEE_ID,
        status: 'PENDING',
      },
      newState: {
        cost_center: RAW_COST_CENTER,
        status: 'ESCALATED',
      },
    });

    expect(create).toHaveBeenCalledWith({
      id: undefined,
      requestId: 'req-pii',
      actorId: ACTOR_ID,
      action: 'RECOMMENDATION_CREATED',
      previousState: {
        employee_id: 'E1***67',
        status: 'PENDING',
      },
      newState: {
        cost_center: 'CC***01',
        status: 'ESCALATED',
      },
    });

    const serializedArgs = JSON.stringify(create.mock.calls[0]?.[0]);
    expect(serializedArgs).not.toContain(RAW_EMPLOYEE_ID);
    expect(serializedArgs).not.toContain(RAW_COST_CENTER);
  });

  it('rejects invalid append input before writing', async () => {
    await expect(
      service.append({
        requestId: '',
        actorId: ACTOR_ID,
        action: 'HUMAN_APPROVED',
        previousState: { status: 'PENDING' },
        newState: { status: 'APPROVED' },
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(create).not.toHaveBeenCalled();
  });

  it('exposes no mutation or deletion methods', () => {
    expect(service).not.toHaveProperty('update');
    expect(service).not.toHaveProperty('delete');
    expect(service).not.toHaveProperty('remove');
    expect(typeof (service as { update?: unknown }).update).toBe('undefined');
    expect(typeof (service as { delete?: unknown }).delete).toBe('undefined');
    expect(typeof (service as { remove?: unknown }).remove).toBe('undefined');

    const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(service)).filter(
      (name) => name !== 'constructor',
    );

    for (const methodName of prototypeMethods) {
      expect(methodName).not.toMatch(/^(update|delete|remove|destroy)/i);
    }

    expect(prototypeMethods).toContain('append');
  });
});
