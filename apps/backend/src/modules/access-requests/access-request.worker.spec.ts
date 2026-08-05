import { Job } from 'bullmq';

import { IdempotencyService, IdempotentResult } from '../idempotency/idempotency.service';
import { AccessRequestProcessedResponse, AccessRequestWorker } from './access-request.worker';
import {
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  ACCESS_REQUEST_WORKER_CONCURRENCY,
  ACCESS_REQUEST_WORKER_ENDPOINT,
  buildWorkerIdempotencyRequestId,
} from './access-requests.constants';
import { AccessRequestDto } from './dto/access-requests.dto';
import { MockDownstreamRateLimitError, MockDownstreamService } from './mock-downstream.service';

describe('AccessRequestWorker', () => {
  const executeIdempotent = jest.fn();
  const invoke = jest.fn<Promise<void>, []>();

  const idempotencyService = {
    executeIdempotent,
  } as unknown as IdempotencyService;

  const mockDownstream = {
    invoke,
  } as unknown as MockDownstreamService;

  const worker = new AccessRequestWorker(idempotencyService, mockDownstream);

  const jobData: AccessRequestDto = {
    requestId: 'req-100',
    employeeId: 'emp-42',
    targetEntitlement: 'vpn-access',
  };

  const job = {
    id: 'req-100',
    data: jobData,
  } as Job<AccessRequestDto>;

  beforeEach(() => {
    executeIdempotent.mockReset();
    invoke.mockReset();
  });

  it('initializes successfully with process defined', () => {
    expect(worker).toBeInstanceOf(AccessRequestWorker);
    expect(typeof worker.process).toBe('function');
  });

  it('applies exponential backoff configuration with attempts 5 and base delay 1000', () => {
    expect(ACCESS_REQUEST_DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    expect(ACCESS_REQUEST_JOB_ATTEMPTS).toBe(5);
    expect(ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS).toBe(1000);
    expect(ACCESS_REQUEST_WORKER_CONCURRENCY).toBe(2);
  });

  it('wraps processing in IdempotencyService with a namespaced worker key', async () => {
    const processed: IdempotentResult<AccessRequestProcessedResponse> = {
      replayed: false,
      response: {
        status: 'processed',
        requestId: 'req-100',
      },
    };

    executeIdempotent.mockImplementation(async (params) => {
      const response = await params.execute();
      return {
        replayed: false,
        response,
      };
    });
    invoke.mockResolvedValue(undefined);

    const result = await worker.process(job);

    expect(executeIdempotent).toHaveBeenCalledTimes(1);
    expect(executeIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: buildWorkerIdempotencyRequestId('req-100'),
        endpoint: ACCESS_REQUEST_WORKER_ENDPOINT,
      }),
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(result).toEqual(processed);
  });

  it('skips mock downstream when IdempotencyService reports a replay', async () => {
    const replayed: IdempotentResult<AccessRequestProcessedResponse> = {
      replayed: true,
      response: {
        status: 'processed',
        requestId: 'req-100',
      },
    };
    executeIdempotent.mockResolvedValue(replayed);

    const result = await worker.process(job);

    expect(result).toEqual(replayed);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('propagates mock downstream rate-limit errors for BullMQ retry', async () => {
    executeIdempotent.mockImplementation(async (params) => {
      return {
        replayed: false,
        response: await params.execute(),
      };
    });
    invoke.mockRejectedValue(new MockDownstreamRateLimitError());

    await expect(worker.process(job)).rejects.toBeInstanceOf(MockDownstreamRateLimitError);
  });
});
