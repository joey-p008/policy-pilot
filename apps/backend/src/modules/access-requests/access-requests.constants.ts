export const ACCESS_REQUEST_QUEUE = 'access-request-queue';
export const ACCESS_REQUEST_JOB_NAME = 'process';
export const ACCESS_REQUESTS_WEBHOOK_ENDPOINT = '/webhooks/access-requests';
export const ACCESS_REQUEST_WORKER_ENDPOINT = '/workers/access-request-queue';
export const ACCESS_REQUEST_WORKER_CONCURRENCY = 2;
export const ACCESS_REQUEST_JOB_ATTEMPTS = 5;
export const ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS = 1000;
export const ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS = 250;

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

export function buildAccessRequestBackoffDelayMs(): number {
  const jitter = Math.floor(Math.random() * (ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS + 1));
  return ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS + jitter;
}
