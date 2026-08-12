import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Worker } from 'bullmq';

import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AccessRequestRepository,
  PROVISIONING_STATUS,
} from '../database/repositories/access-request.repository';
import { AccessGrantQueueService } from './access-grant-queue.service';
import {
  ACCESS_GRANT_QUEUE,
  ACCESS_GRANT_WORKER_CONCURRENCY,
  ACCESS_GRANT_WORKER_LIMITER,
} from './access-requests.constants';
import type { EntitlementExecutionInput } from './dto/entitlement-execution.dto';
import { EntitlementExecutionService } from './entitlement-execution.service';
import { MockDownstreamRateLimitError } from './mock-downstream.service';

export interface AccessGrantProcessedResponse {
  status: 'provisioned';
  requestId: string;
}

@Injectable()
@Processor(ACCESS_GRANT_QUEUE, {
  concurrency: ACCESS_GRANT_WORKER_CONCURRENCY,
  limiter: {
    max: ACCESS_GRANT_WORKER_LIMITER.max,
    duration: ACCESS_GRANT_WORKER_LIMITER.duration,
  },
})
export class AccessGrantWorker extends WorkerHost {
  private readonly logger = new Logger(AccessGrantWorker.name);

  public constructor(
    private readonly entitlementExecutionService: EntitlementExecutionService,
    private readonly accessRequestRepository: AccessRequestRepository,
    private readonly accessGrantQueueService: AccessGrantQueueService,
    private readonly auditLogService: AuditLogService,
  ) {
    super();
  }

  public async process(job: Job<EntitlementExecutionInput>): Promise<AccessGrantProcessedResponse> {
    try {
      await this.entitlementExecutionService.grant(job.data);
    } catch (error: unknown) {
      if (error instanceof MockDownstreamRateLimitError) {
        // Stall the queue and hand the job back unharmed. BullMQ treats
        // RateLimitError specially, requeueing without spending an attempt, so
        // a saturated downstream costs us throughput rather than retries.
        await this.accessGrantQueueService.pauseForRateLimit(error.retryAfterMs);
        this.logger.warn(
          `Downstream saturated; pausing grant queue for ${error.retryAfterMs}ms and requeueing ` +
            `${job.data.requestId}`,
        );

        throw Worker.RateLimitError();
      }

      throw error;
    }

    await this.accessRequestRepository.updateProvisioningStatus({
      requestId: job.data.requestId,
      provisioningStatus: PROVISIONING_STATUS.PROVISIONED,
    });

    this.logger.log(`Provisioned access request ${job.data.requestId}`);

    return {
      status: 'provisioned',
      requestId: job.data.requestId,
    };
  }

  /**
   * Only records a terminal failure once BullMQ has spent the whole retry
   * budget; earlier attempts are still in flight and must not flip the request
   * out of QUEUED.
   */
  @OnWorkerEvent('failed')
  public async onFailed(job: Job<EntitlementExecutionInput> | undefined): Promise<void> {
    if (job === undefined) {
      this.logger.error('Grant job failed before its payload could be read');
      return;
    }

    const allowedAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade < allowedAttempts) {
      this.logger.warn(
        `Grant for ${job.data.requestId} failed on attempt ${job.attemptsMade} of ` +
          `${allowedAttempts}; a retry is still pending`,
      );
      return;
    }

    // BullMQ attaches no rejection handler to this listener, so an escaping
    // error becomes an unhandled rejection that tears down the process. The
    // job is already terminally failed and there is no caller to propagate to,
    // so the only safe contract here is to record what we can and log the rest.
    try {
      await this.recordTerminalFailure(job);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(
        `Grant for ${job.data.requestId} exhausted ${allowedAttempts} attempts, but the FAILED ` +
          `state could not be persisted: ${reason}`,
      );
      return;
    }

    this.logger.error(
      `Grant for ${job.data.requestId} exhausted ${allowedAttempts} attempts and was marked FAILED`,
    );
  }

  private async recordTerminalFailure(job: Job<EntitlementExecutionInput>): Promise<void> {
    await this.accessRequestRepository.updateProvisioningStatus({
      requestId: job.data.requestId,
      provisioningStatus: PROVISIONING_STATUS.FAILED,
    });

    await this.auditLogService.append({
      requestId: job.data.requestId,
      actorId: job.data.actorUserId,
      action: 'ACCESS_GRANT_FAILED',
      previousState: { provisioning_status: PROVISIONING_STATUS.QUEUED },
      newState: {
        provisioning_status: PROVISIONING_STATUS.FAILED,
        system_name: job.data.systemName,
        entitlement_key: job.data.targetEntitlement,
        attempts_made: job.attemptsMade,
        failed_reason: job.failedReason ?? 'unknown',
      },
    });
  }
}
