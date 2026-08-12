import {
  ACCESS_GRANT_BACKOFF_BASE_DELAY_MS,
  ACCESS_GRANT_JOB_ATTEMPTS,
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
  INGEST_EXPECTED_JOB_LATENCY_MS,
  ORG_BURST_RATE_LIMIT_MAX,
  ORG_BURST_RATE_LIMIT_WINDOW_MS,
  concurrencyForThroughput,
} from '../../config/rate-limit.config';

export {
  ACCESS_GRANT_BACKOFF_BASE_DELAY_MS,
  ACCESS_GRANT_JOB_ATTEMPTS,
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
};

export const ACCESS_REQUEST_QUEUE = 'access-request-queue';
export const ACCESS_REQUEST_JOB_NAME = 'process';
export const ACCESS_REQUESTS_WEBHOOK_ENDPOINT = '/webhooks/access-requests';
export const ACCESS_REQUEST_WORKER_ENDPOINT = '/workers/access-request-queue';
export const ACCESS_GRANT_IDEMPOTENCY_ENDPOINT = '/access-requests/grant';

/**
 * Ingest only builds recommendations, so it is paced at the inbound org-wide
 * burst rather than the downstream contract. Borrowing the downstream limit
 * here would throttle ingest five times tighter than events arrive while
 * protecting nothing, because this queue never reaches a downstream adapter.
 */
export const ACCESS_REQUEST_WORKER_LIMITER = {
  max: ORG_BURST_RATE_LIMIT_MAX,
  duration: ORG_BURST_RATE_LIMIT_WINDOW_MS,
} as const;

export const ACCESS_REQUEST_WORKER_CONCURRENCY = concurrencyForThroughput({
  ratePerWindow: ORG_BURST_RATE_LIMIT_MAX,
  windowMs: ORG_BURST_RATE_LIMIT_WINDOW_MS,
  expectedJobLatencyMs: INGEST_EXPECTED_JOB_LATENCY_MS,
});

export const ACCESS_REQUEST_DEFAULT_JOB_OPTIONS = {
  attempts: ACCESS_REQUEST_JOB_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  },
};

export const ACCESS_GRANT_QUEUE = 'access-grant-queue';
export const ACCESS_GRANT_JOB_NAME = 'execute-grant';

/**
 * Entitlement execution is the only path that reaches a downstream adapter, so
 * this queue carries the 60/min contract. Concurrency stays deliberately small:
 * the limiter is the governor, and fewer in-flight jobs means less bunching at
 * the boundary between BullMQ's fixed window and the downstream sliding window.
 */
export const ACCESS_GRANT_WORKER_LIMITER = {
  max: DOWNSTREAM_RATE_LIMIT_MAX,
  duration: DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} as const;

export const ACCESS_GRANT_WORKER_CONCURRENCY = 2;

/**
 * Retention caps keep a sustained 300/min burst from growing Redis without
 * bound once the grants have settled.
 */
export const ACCESS_GRANT_COMPLETED_JOB_RETENTION = 1_000;
export const ACCESS_GRANT_FAILED_JOB_RETENTION = 5_000;

export const ACCESS_GRANT_DEFAULT_JOB_OPTIONS = {
  attempts: ACCESS_GRANT_JOB_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: ACCESS_GRANT_BACKOFF_BASE_DELAY_MS,
  },
  removeOnComplete: ACCESS_GRANT_COMPLETED_JOB_RETENTION,
  removeOnFail: ACCESS_GRANT_FAILED_JOB_RETENTION,
};

export function buildAccessRequestStatusUrl(requestId: string): string {
  return `/access-requests/${requestId}/status`;
}

export function buildWorkerIdempotencyRequestId(requestId: string): string {
  return `worker:access-request:${requestId}`;
}

export function buildGrantIdempotencyRequestId(requestId: string): string {
  return `grant:${requestId}`;
}

/** BullMQ rejects a custom job id containing ':', so the prefix uses a dash. */
export function buildAccessGrantJobId(requestId: string): string {
  return `grant-job-${requestId}`;
}

export function buildAccessRequestBackoffDelayMs(): number {
  const jitter = Math.floor(Math.random() * (ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS + 1));
  return ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS + jitter;
}
