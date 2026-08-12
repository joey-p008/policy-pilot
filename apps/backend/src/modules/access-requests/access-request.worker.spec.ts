import { Job } from 'bullmq';

import {
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
  cumulativeBackoffMs,
} from '../../config/rate-limit.config';
import { IdempotencyService, IdempotentResult } from '../idempotency/idempotency.service';
import { AccessRecommendationService } from './access-recommendation.service';
import { AccessRequestProcessedResponse, AccessRequestWorker } from './access-request.worker';
import {
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_DEFAULT_JOB_OPTIONS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  ACCESS_REQUEST_WORKER_CONCURRENCY,
  ACCESS_REQUEST_WORKER_ENDPOINT,
  ACCESS_REQUEST_WORKER_LIMITER,
  buildWorkerIdempotencyRequestId,
} from './access-requests.constants';
import { AccessRequestDto } from './dto/access-requests.dto';

describe('AccessRequestWorker', () => {
  const createFromWebhook = jest.fn();
  const executeIdempotent = jest.fn();

  const idempotencyService = {
    executeIdempotent,
  } as unknown as IdempotencyService;

  const accessRecommendationService = {
    createFromWebhook,
  } as unknown as AccessRecommendationService;

  const worker = new AccessRequestWorker(idempotencyService, accessRecommendationService);

  const jobData: AccessRequestDto = {
    request_id: 'req-100',
    employee_id: 'emp-42',
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

  const job = {
    id: 'req-100',
    data: jobData,
  } as Job<AccessRequestDto>;

  beforeEach(() => {
    executeIdempotent.mockReset();
    createFromWebhook.mockReset();
  });

  it('initializes successfully with process defined', () => {
    expect(worker).toBeInstanceOf(AccessRequestWorker);
    expect(typeof worker.process).toBe('function');
  });

  it('applies exponential backoff configuration with attempts 8 and base delay 1000', () => {
    expect(ACCESS_REQUEST_DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 8,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
    expect(ACCESS_REQUEST_JOB_ATTEMPTS).toBe(8);
    expect(ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS).toBe(1000);
    expect(ACCESS_REQUEST_WORKER_CONCURRENCY).toBe(2);
  });

  it('sizes the retry budget to outlast one full downstream rate-limit window', () => {
    expect(
      cumulativeBackoffMs(ACCESS_REQUEST_JOB_ATTEMPTS, ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS),
    ).toBeGreaterThanOrEqual(DOWNSTREAM_RATE_LIMIT_WINDOW_MS);
  });

  it('paces the worker limiter at the downstream rate-limit contract', () => {
    expect(ACCESS_REQUEST_WORKER_LIMITER).toEqual({
      max: DOWNSTREAM_RATE_LIMIT_MAX,
      duration: DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
    });
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
    createFromWebhook.mockResolvedValue({} as never);

    const result = await worker.process(job);

    expect(executeIdempotent).toHaveBeenCalledTimes(1);
    expect(executeIdempotent).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: buildWorkerIdempotencyRequestId('req-100'),
        endpoint: ACCESS_REQUEST_WORKER_ENDPOINT,
      }),
    );
    expect(createFromWebhook).toHaveBeenCalledWith(jobData);
    expect(result).toEqual(processed);
  });

  it('skips recommendation creation when IdempotencyService reports a replay', async () => {
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
    expect(createFromWebhook).not.toHaveBeenCalled();
  });
});
