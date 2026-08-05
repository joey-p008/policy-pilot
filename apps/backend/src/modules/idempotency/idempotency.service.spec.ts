import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { IdempotencyKeyRepository } from '../database/repositories/idempotency-key.repository';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const findByRequestId = jest.fn();
  const create = jest.fn();
  const repository = {
    findByRequestId,
    create,
  } as unknown as IdempotencyKeyRepository;

  const service = new IdempotencyService(repository);

  const cachedPayload = {
    status: 'accepted',
    recommendation: 'ESCALATE',
  };

  const cachedRow = {
    requestId: 'req-1',
    endpoint: '/webhooks/access-requests',
    responsePayload: cachedPayload,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    findByRequestId.mockReset();
    create.mockReset();
  });

  it('writes once on first request and returns replayed false', async () => {
    const execute = jest.fn().mockResolvedValue(cachedPayload);
    findByRequestId.mockResolvedValue(null);
    create.mockResolvedValue(cachedRow);

    const result = await service.executeIdempotent({
      requestId: 'req-1',
      endpoint: '/webhooks/access-requests',
      execute,
    });

    expect(result).toEqual({
      replayed: false,
      response: cachedPayload,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      requestId: 'req-1',
      endpoint: '/webhooks/access-requests',
      responsePayload: cachedPayload,
    });
  });

  it('returns cached response for duplicate request_id without execute or create', async () => {
    const execute = jest.fn().mockResolvedValue({ status: 'should-not-run' });
    findByRequestId.mockResolvedValue(cachedRow);

    const result = await service.executeIdempotent({
      requestId: 'req-1',
      endpoint: '/webhooks/access-requests',
      execute,
    });

    expect(result).toEqual({
      replayed: true,
      response: cachedPayload,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(findByRequestId).toHaveBeenCalledWith('req-1');
  });

  it('rejects empty requestId before touching the repository', async () => {
    const execute = jest.fn();

    await expect(
      service.executeIdempotent({
        requestId: '',
        endpoint: '/webhooks/access-requests',
        execute,
      }),
    ).rejects.toBeInstanceOf(ZodError);

    expect(findByRequestId).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('replays cached payload when create races with P2002', async () => {
    const execute = jest.fn().mockResolvedValue(cachedPayload);
    findByRequestId.mockResolvedValueOnce(null).mockResolvedValueOnce(cachedRow);

    const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    create.mockRejectedValue(conflict);

    const result = await service.executeIdempotent({
      requestId: 'req-1',
      endpoint: '/webhooks/access-requests',
      execute,
    });

    expect(result).toEqual({
      replayed: true,
      response: cachedPayload,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(findByRequestId).toHaveBeenCalledTimes(2);
  });
});
