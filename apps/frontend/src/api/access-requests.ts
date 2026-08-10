import type {
  AccessRequestDecisionPayload,
  AccessRequestDecisionResult,
  PendingAccessRequest,
} from '@policy-pilot/shared-types';

import { apiClient } from '../lib/apiClient';
import { applyMockDecision, getMockPendingAccessRequests } from '../mocks/pending-access-requests';

export const ACCESS_REQUESTS_PENDING_QUERY_KEY = ['access-requests', 'pending'] as const;
export { MOCK_HITL_ADMIN_ID } from './hitl-constants';

function shouldUseHitlMockData(): boolean {
  return import.meta.env.VITE_HITL_USE_MOCK_DATA === 'true';
}

export async function fetchPendingAccessRequests(): Promise<PendingAccessRequest[]> {
  if (shouldUseHitlMockData()) {
    return getMockPendingAccessRequests();
  }

  const response = await apiClient.get<PendingAccessRequest[]>('/access-requests/pending');
  return response.data;
}

export async function approveAccessRequest(
  payload: AccessRequestDecisionPayload,
): Promise<AccessRequestDecisionResult> {
  if (shouldUseHitlMockData()) {
    return applyMockDecision(payload, 'approved');
  }

  const response = await apiClient.post<AccessRequestDecisionResult>(
    `/access-requests/${payload.requestId}/approve`,
    { admin_id: payload.admin_id },
  );
  return response.data;
}

export async function denyAccessRequest(
  payload: AccessRequestDecisionPayload,
): Promise<AccessRequestDecisionResult> {
  if (shouldUseHitlMockData()) {
    return applyMockDecision(payload, 'denied');
  }

  const response = await apiClient.post<AccessRequestDecisionResult>(
    `/access-requests/${payload.requestId}/deny`,
    { admin_id: payload.admin_id },
  );
  return response.data;
}
