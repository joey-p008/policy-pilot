import type { AccessRequestDecisionResult, PendingAccessRequest } from '@policy-pilot/shared-types';

import { apiClient } from '../lib/apiClient';

export const ACCESS_REQUESTS_PENDING_QUERY_KEY = ['access-requests', 'pending'] as const;

export async function fetchPendingAccessRequests(): Promise<PendingAccessRequest[]> {
  const response = await apiClient.get<PendingAccessRequest[]>('/access-requests/pending');
  return response.data;
}

export async function approveAccessRequest(
  requestId: string,
): Promise<AccessRequestDecisionResult> {
  const response = await apiClient.post<AccessRequestDecisionResult>(
    `/access-requests/${requestId}/approve`,
  );
  return response.data;
}

export async function denyAccessRequest(requestId: string): Promise<AccessRequestDecisionResult> {
  const response = await apiClient.post<AccessRequestDecisionResult>(
    `/access-requests/${requestId}/deny`,
  );
  return response.data;
}
