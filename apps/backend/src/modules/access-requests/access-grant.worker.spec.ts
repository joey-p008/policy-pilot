import { Job } from 'bullmq';

import {
  ACCESS_GRANT_BACKOFF_BASE_DELAY_MS,
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} from '../../config/rate-limit.config';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AccessRequestRepository,
  PROVISIONING_STATUS,
} from '../database/repositories/access-request.repository';
import { AccessGrantQueueService } from './access-grant-queue.service';
import { AccessGrantWorker } from './access-grant.worker';
import {
  ACCESS_GRANT_DEFAULT_JOB_OPTIONS,
  ACCESS_GRANT_JOB_ATTEMPTS,
  ACCESS_GRANT_WORKER_CONCURRENCY,
  ACCESS_GRANT_WORKER_LIMITER,
} from './access-requests.constants';
import type { EntitlementExecutionInput } from './dto/entitlement-execution.dto';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { MockDownstreamRateLimitError } from './mock-downstream.service';

const ACTOR_USER_ID = 'f1c2a3b4-5d6e-4789-a012-3456789abcde';

const jobData: EntitlementExecutionInput = {
  requestId: 'req-grant-worker-1',
  employeeId: 'E-MOCK-042',
  actorUserId: ACTOR_USER_ID,
  systemName: 'DATA_WAREHOUSE',
  targetEntitlement: 'FIN_DATASET_READ',
};

function buildJob(
  overrides: Partial<Job<EntitlementExecutionInput>> = {},
): Job<EntitlementExecutionInput> {
  return {
    id: 'grant-job:req-grant-worker-1',
    data: jobData,
    attemptsMade: 0,
    opts: { attempts: ACCESS_GRANT_JOB_ATTEMPTS },
    ...overrides,
  } as Job<EntitlementExecutionInput>;
}

describe('AccessGrantWorker', () => {
  const grant = jest.fn();
  const updateProvisioningStatus = jest.fn();
  const pauseForRateLimit = jest.fn();
  const append = jest.fn();

  const worker = new AccessGrantWorker(
    { grant } as unknown as EntitlementExecutionService,
    { updateProvisioningStatus } as unknown as AccessRequestRepository,
    { pauseForRateLimit } as unknown as AccessGrantQueueService,
    { append } as unknown as AuditLogService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    grant.mockResolvedValue({ status: 'granted', requestId: jobData.requestId });
    updateProvisioningStatus.mockResolvedValue({});
    pauseForRateLimit.mockResolvedValue(undefined);
    append.mockResolvedValue({});
  });

  describe('queue contract', () => {
    it('paces the grant worker at the downstream rate-limit contract', () => {
      expect(ACCESS_GRANT_WORKER_LIMITER).toEqual({
        max: DOWNSTREAM_RATE_LIMIT_MAX,
        duration: DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
      });
    });

    it('keeps concurrency below the ceiling so the limiter stays the governor', () => {
      expect(ACCESS_GRANT_WORKER_CONCURRENCY).toBeGreaterThan(0);
      expect(ACCESS_GRANT_WORKER_CONCURRENCY).toBeLessThan(DOWNSTREAM_RATE_LIMIT_MAX);
    });

    it('retries transient faults with exponential backoff and bounded retention', () => {
      expect(ACCESS_GRANT_DEFAULT_JOB_OPTIONS).toEqual({
        attempts: ACCESS_GRANT_JOB_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: ACCESS_GRANT_BACKOFF_BASE_DELAY_MS,
        },
        removeOnComplete: expect.any(Number),
        removeOnFail: expect.any(Number),
      });
    });
  });

  describe('process', () => {
    it('executes the grant and marks the request PROVISIONED', async () => {
      const result = await worker.process(buildJob());

      expect(grant).toHaveBeenCalledWith(jobData);
      expect(updateProvisioningStatus).toHaveBeenCalledWith({
        requestId: jobData.requestId,
        provisioningStatus: PROVISIONING_STATUS.PROVISIONED,
      });
      expect(result).toEqual({ status: 'provisioned', requestId: jobData.requestId });
    });

    it('pauses the queue for the advertised retry-after when the downstream is saturated', async () => {
      grant.mockRejectedValue(new MockDownstreamRateLimitError(1_200));

      await expect(worker.process(buildJob())).rejects.toThrow();
      expect(pauseForRateLimit).toHaveBeenCalledWith(1_200);
    });

    it('signals a BullMQ rate limit so the job requeues without consuming an attempt', async () => {
      grant.mockRejectedValue(new MockDownstreamRateLimitError(500));

      // BullMQ recognises this exact message and moves the job back to wait
      // instead of counting a failed attempt.
      await expect(worker.process(buildJob())).rejects.toThrow('bullmq:rateLimitExceeded');
    });

    it('leaves provisioning status untouched when the downstream rate limits', async () => {
      grant.mockRejectedValue(new MockDownstreamRateLimitError(500));

      await expect(worker.process(buildJob())).rejects.toThrow();
      expect(updateProvisioningStatus).not.toHaveBeenCalled();
    });

    it('propagates a non-rate-limit failure so BullMQ can apply backoff', async () => {
      grant.mockRejectedValue(new Error('downstream adapter exploded'));

      await expect(worker.process(buildJob())).rejects.toThrow('downstream adapter exploded');
      expect(pauseForRateLimit).not.toHaveBeenCalled();
      expect(updateProvisioningStatus).not.toHaveBeenCalled();
    });
  });

  describe('onFailed', () => {
    it('keeps the request QUEUED while retries remain', async () => {
      await worker.onFailed(buildJob({ attemptsMade: 1 }));

      expect(updateProvisioningStatus).not.toHaveBeenCalled();
      expect(append).not.toHaveBeenCalled();
    });

    it('marks the request FAILED and audits once the retry budget is spent', async () => {
      await worker.onFailed(
        buildJob({ attemptsMade: ACCESS_GRANT_JOB_ATTEMPTS, failedReason: 'adapter timeout' }),
      );

      expect(updateProvisioningStatus).toHaveBeenCalledWith({
        requestId: jobData.requestId,
        provisioningStatus: PROVISIONING_STATUS.FAILED,
      });
      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: jobData.requestId,
          actorId: ACTOR_USER_ID,
          action: 'ACCESS_GRANT_FAILED',
        }),
      );
    });

    it('records the failure reason and attempt count in the audit trail', async () => {
      await worker.onFailed(
        buildJob({ attemptsMade: ACCESS_GRANT_JOB_ATTEMPTS, failedReason: 'adapter timeout' }),
      );

      expect(append).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: expect.objectContaining({
            attempts_made: ACCESS_GRANT_JOB_ATTEMPTS,
            failed_reason: 'adapter timeout',
          }),
        }),
      );
    });

    it('tolerates a failure event that carries no job payload', async () => {
      await expect(worker.onFailed(undefined)).resolves.toBeUndefined();
      expect(updateProvisioningStatus).not.toHaveBeenCalled();
    });

    it('does not reject when the access request row no longer exists', async () => {
      // A stale queue job can outlive its request row. BullMQ attaches no
      // rejection handler to this listener, so escaping here would surface as
      // an unhandled rejection and take down the process.
      updateProvisioningStatus.mockRejectedValue(new Error('No record was found for an update.'));

      await expect(
        worker.onFailed(buildJob({ attemptsMade: ACCESS_GRANT_JOB_ATTEMPTS })),
      ).resolves.toBeUndefined();
      expect(append).not.toHaveBeenCalled();
    });

    it('does not reject when the audit append fails', async () => {
      append.mockRejectedValue(new Error('audit log unavailable'));

      await expect(
        worker.onFailed(buildJob({ attemptsMade: ACCESS_GRANT_JOB_ATTEMPTS })),
      ).resolves.toBeUndefined();
      expect(updateProvisioningStatus).toHaveBeenCalledTimes(1);
    });
  });
});
