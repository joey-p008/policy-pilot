import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import {
  ACCESS_GRANT_JOB_NAME,
  ACCESS_GRANT_QUEUE,
  buildAccessGrantJobId,
} from './access-requests.constants';
import {
  entitlementExecutionInputSchema,
  type EntitlementExecutionInput,
} from './dto/entitlement-execution.dto';

/** Job states that have not yet reached a downstream adapter. */
const CANCELLABLE_JOB_STATES = new Set(['waiting', 'delayed', 'prioritized', 'waiting-children']);

@Injectable()
export class AccessGrantQueueService {
  private readonly logger = new Logger(AccessGrantQueueService.name);

  public constructor(
    @InjectQueue(ACCESS_GRANT_QUEUE)
    private readonly accessGrantQueue: Queue<EntitlementExecutionInput>,
  ) {}

  /**
   * Hands the grant to the rate-limited worker instead of calling the
   * downstream inline. This is the backpressure boundary: a burst of approvals
   * lands durably in Redis rather than saturating the 60/min adapter contract.
   */
  public async enqueueGrant(input: EntitlementExecutionInput): Promise<void> {
    const validated = entitlementExecutionInputSchema.parse(input);

    await this.accessGrantQueue.add(ACCESS_GRANT_JOB_NAME, validated, {
      jobId: buildAccessGrantJobId(validated.requestId),
    });
  }

  /**
   * Stalls every consumer of this queue for `expireTimeMs`. Paired with
   * BullMQ's `RateLimitError`, this converts a downstream rejection into real
   * backpressure: the worker stops pulling instead of spinning through its
   * retry budget while the adapter is saturated.
   */
  public async pauseForRateLimit(expireTimeMs: number): Promise<void> {
    await this.accessGrantQueue.rateLimit(expireTimeMs);
  }

  /**
   * Removes a grant that has not started executing yet, so an override away
   * from APPROVED cannot be undone moments later by a job still sitting in the
   * queue. Returns whether a pending job was actually withdrawn.
   */
  public async cancelQueuedGrant(requestId: string): Promise<boolean> {
    const jobId = buildAccessGrantJobId(requestId);
    const job = await this.accessGrantQueue.getJob(jobId);

    if (job === undefined) {
      return false;
    }

    const state = await job.getState();

    if (!CANCELLABLE_JOB_STATES.has(state)) {
      this.logger.warn(
        `Grant job ${jobId} is already ${state}; leaving it for the reversal to revoke`,
      );
      return false;
    }

    try {
      await job.remove();
    } catch (error: unknown) {
      // The worker can pick the job up between the state read and the removal.
      // Losing that race is expected, and the caller's revoke still repairs the
      // entitlement, so report it rather than failing the override.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(
        `Grant job ${jobId} started executing before it could be withdrawn: ${reason}`,
      );
      return false;
    }

    this.logger.log(`Withdrew queued grant job ${jobId} before it reached the downstream`);

    return true;
  }
}
