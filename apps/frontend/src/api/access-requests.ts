import type {
  AccessRequestDecisionPayload,
  AccessRequestDecisionResult,
  AccessRequestHistoryItem,
  CreateAccessRequestPayload,
  PendingAccessRequest,
} from '@policy-pilot/shared-types';

import { apiClient } from '../lib/apiClient';
import {
  applyMockDecision,
  createMockAccessRequest,
  getMockHistoryAccessRequests,
  getMockPendingAccessRequests,
} from '../mocks/pending-access-requests';

export {
  ACCESS_REQUESTS_HISTORY_QUERY_KEY,
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
} from './access-request-keys';

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

export async function fetchAccessRequestHistory(): Promise<AccessRequestHistoryItem[]> {
  if (shouldUseHitlMockData()) {
    return getMockHistoryAccessRequests();
  }

  const response = await apiClient.get<AccessRequestHistoryItem[]>('/access-requests/history');
  return response.data;
}

export async function createAccessRequest(
  payload: CreateAccessRequestPayload,
): Promise<PendingAccessRequest> {
  if (shouldUseHitlMockData()) {
    return createMockAccessRequest(payload);
  }

  const response = await apiClient.post<PendingAccessRequest>('/access-requests', payload);
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
  );
  return response.data;
}

export async function escalateAccessRequest(
  payload: AccessRequestDecisionPayload,
): Promise<AccessRequestDecisionResult> {
  if (shouldUseHitlMockData()) {
    return applyMockDecision(payload, 'escalated');
  }

  const response = await apiClient.post<AccessRequestDecisionResult>(
    `/access-requests/${payload.requestId}/escalate`,
  );
  return response.data;
}
