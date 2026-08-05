export const ACCESS_REQUEST_QUEUE = 'access-request-queue';
export const ACCESS_REQUEST_JOB_NAME = 'process';
export const ACCESS_REQUESTS_WEBHOOK_ENDPOINT = '/webhooks/access-requests';

export function buildAccessRequestStatusUrl(requestId: string): string {
  return `/access-requests/${requestId}/status`;
}
