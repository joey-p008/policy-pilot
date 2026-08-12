import {
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} from '../../config/rate-limit.config';

export {
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
};

export const ACCESS_REQUEST_QUEUE = 'access-request-queue';
export const ACCESS_REQUEST_JOB_NAME = 'process';
export const ACCESS_REQUESTS_WEBHOOK_ENDPOINT = '/webhooks/access-requests';
export const ACCESS_REQUEST_WORKER_ENDPOINT = '/workers/access-request-queue';
export const ACCESS_GRANT_IDEMPOTENCY_ENDPOINT = '/access-requests/grant';
export const ACCESS_REQUEST_WORKER_CONCURRENCY = 2;

/**
 * Paces the worker at the downstream contract so we never intentionally exceed
 * the agreed rate. BullMQ's limiter is a fixed window in Redis while the
 * downstream enforces a sliding window, so a window-boundary burst can still be
 * rejected; the exponential backoff budget absorbs that residual overlap.
 */
export const ACCESS_REQUEST_WORKER_LIMITER = {
  max: DOWNSTREAM_RATE_LIMIT_MAX,
  duration: DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} as const;

export const ACCESS_REQUEST_DEFAULT_JOB_OPTIONS = {
  attempts: ACCESS_REQUEST_JOB_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  },
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

export function buildAccessRequestBackoffDelayMs(): number {
  const jitter = Math.floor(Math.random() * (ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS + 1));
  return ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS + jitter;
}
