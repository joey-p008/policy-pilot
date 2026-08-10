/** @jest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PendingAccessRequest } from '@policy-pilot/shared-types';
import type { JSX, ReactNode } from 'react';

import {
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
  approveAccessRequest,
  denyAccessRequest,
  fetchPendingAccessRequests,
} from '../api/access-requests';
import { MOCK_HITL_ADMIN_ID } from '../api/hitl-constants';
import { useApproveRequest, useDenyRequest, usePendingRequests } from './useAccessRequests';

jest.mock('../api/access-requests', () => ({
  ACCESS_REQUESTS_PENDING_QUERY_KEY: ['access-requests', 'pending'],
  fetchPendingAccessRequests: jest.fn(),
  approveAccessRequest: jest.fn(),
  denyAccessRequest: jest.fn(),
}));

const mockedFetchPendingAccessRequests = fetchPendingAccessRequests as jest.MockedFunction<
  typeof fetchPendingAccessRequests
>;
const mockedApproveAccessRequest = approveAccessRequest as jest.MockedFunction<
  typeof approveAccessRequest
>;
const mockedDenyAccessRequest = denyAccessRequest as jest.MockedFunction<typeof denyAccessRequest>;

const pendingRequest: PendingAccessRequest = {
  requestId: 'req-1',
  employeeId: 'emp-hashed',
  targetEntitlement: 'prod-postgres-admin',
  currentEntitlements: ['prod-postgres-read'],
  recommendation: {
    decision: 'DENY',
    rationale: 'Missing approved change ticket.',
    policyCitations: [
      {
        documentId: 'POL-2026-02',
        pageNumber: 4,
        sectionTitle: 'Privileged Access',
        content: 'Production admin requires an approved change ticket.',
      },
    ],
    confidenceScore: 0.91,
  },
};

const decisionPayload = {
  requestId: 'req-1',
  admin_id: MOCK_HITL_ADMIN_ID,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }): JSX.Element {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAccessRequests hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads pending access requests', async () => {
    mockedFetchPendingAccessRequests.mockResolvedValue([pendingRequest]);

    const { result } = renderHook(() => usePendingRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetchPendingAccessRequests).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([pendingRequest]);
    expect(ACCESS_REQUESTS_PENDING_QUERY_KEY).toEqual(['access-requests', 'pending']);
  });

  it('approves a request and invalidates the pending list', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedApproveAccessRequest.mockResolvedValue({
      requestId: 'req-1',
      status: 'approved',
    });

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        approve: useApproveRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.approve.mutate(decisionPayload);

    await waitFor(() => {
      expect(result.current.approve.isSuccess).toBe(true);
      expect(result.current.pending.data).toEqual([]);
    });

    expect(mockedApproveAccessRequest).toHaveBeenCalledWith(decisionPayload, expect.anything());
    expect(mockedFetchPendingAccessRequests).toHaveBeenCalledTimes(2);
  });

  it('denies a request and invalidates the pending list', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedDenyAccessRequest.mockResolvedValue({
      requestId: 'req-1',
      status: 'denied',
    });

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        deny: useDenyRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.deny.mutate(decisionPayload);

    await waitFor(() => {
      expect(result.current.deny.isSuccess).toBe(true);
      expect(result.current.pending.data).toEqual([]);
    });

    expect(mockedDenyAccessRequest).toHaveBeenCalledWith(decisionPayload, expect.anything());
    expect(mockedFetchPendingAccessRequests).toHaveBeenCalledTimes(2);
  });

  it('optimistically removes a pending request before refetch settles', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedApproveAccessRequest.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              requestId: 'req-1',
              status: 'approved',
            });
          }, 50);
        }),
    );

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        approve: useApproveRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.approve.mutate(decisionPayload);

    await waitFor(() => {
      expect(result.current.pending.data).toEqual([]);
    });

    await waitFor(() => {
      expect(result.current.approve.isSuccess).toBe(true);
    });
  });

  it('rolls back the pending list when approve fails', async () => {
    mockedFetchPendingAccessRequests.mockResolvedValue([pendingRequest]);
    mockedApproveAccessRequest.mockRejectedValue(new Error('approve failed'));

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        approve: useApproveRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.approve.mutate(decisionPayload);

    await waitFor(() => {
      expect(result.current.approve.isError).toBe(true);
      expect(result.current.pending.data).toEqual([pendingRequest]);
    });
  });
});
