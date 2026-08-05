import { ZodError } from 'zod';

import { PrismaService } from '../prisma.service';
import { AccessAuditLogRepository } from './access-audit-log.repository';

describe('AccessAuditLogRepository', () => {
  const createMock = jest.fn();
  const prisma = {
    accessAuditLog: {
      create: createMock,
    },
  } as unknown as PrismaService;

  const repository = new AccessAuditLogRepository(prisma);

  beforeEach(() => {
    createMock.mockReset();
  });

  it('rejects missing non-nullable audit fields before writing', async () => {
    await expect(
      repository.create({
        requestId: 'req-1',
        actorId: '8d0504b3-0e57-454a-833f-1c22aec8089b',
        action: 'HUMAN_APPROVED',
        previousState: { status: 'PENDING' },
      } as never),
    ).rejects.toBeInstanceOf(ZodError);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('rejects null previousState and newState', async () => {
    await expect(
      repository.create({
        requestId: 'req-1',
        actorId: '8d0504b3-0e57-454a-833f-1c22aec8089b',
        action: 'HUMAN_APPROVED',
        previousState: null,
        newState: null,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates an audit log with actor FK connect after validation', async () => {
    const actorId = '041aa56a-3752-44ec-a157-436d4f30328f';
    createMock.mockResolvedValue({
      id: '82584cee-6bae-40dd-b620-e16c4613e06d',
      requestId: 'req-1',
      actorId,
      action: 'HUMAN_APPROVED',
      previousState: { status: 'PENDING' },
      newState: { status: 'APPROVED' },
      timestamp: new Date(),
    });

    await repository.create({
      requestId: 'req-1',
      actorId,
      action: 'HUMAN_APPROVED',
      previousState: { status: 'PENDING' },
      newState: { status: 'APPROVED' },
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        id: undefined,
        requestId: 'req-1',
        action: 'HUMAN_APPROVED',
        previousState: { status: 'PENDING' },
        newState: { status: 'APPROVED' },
        actor: {
          connect: { id: actorId },
        },
      },
    });
  });
});
