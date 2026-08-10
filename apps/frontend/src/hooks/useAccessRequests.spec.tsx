/** @jest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PendingAccessRequest } from '@policy-pilot/shared-types';
import type { JSX, ReactNode } from 'react';

import { apiClient } from '../lib/apiClient';
import { useApproveRequest, useDenyRequest, usePendingRequests } from './useAccessRequests';

jest.mock('../lib/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const mockedApiClient = apiClient as jest.Mocked<Pick<typeof apiClient, 'get' | 'post'>>;

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
      },
    ],
    confidenceScore: 0.91,
  },
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
    mockedApiClient.get.mockResolvedValue({ data: [pendingRequest] });

    const { result } = renderHook(() => usePendingRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedApiClient.get).toHaveBeenCalledWith('/access-requests/pending');
    expect(result.current.data).toEqual([pendingRequest]);
  });

  it('approves a request and invalidates the pending list', async () => {
    mockedApiClient.get
      .mockResolvedValueOnce({ data: [pendingRequest] })
      .mockResolvedValueOnce({ data: [] });
    mockedApiClient.post.mockResolvedValue({
      data: { requestId: 'req-1', status: 'approved' },
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

    result.current.approve.mutate('req-1');

    await waitFor(() => {
      expect(result.current.approve.isSuccess).toBe(true);
      expect(result.current.pending.data).toEqual([]);
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/access-requests/req-1/approve');
    expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
  });

  it('denies a request and invalidates the pending list', async () => {
    mockedApiClient.get
      .mockResolvedValueOnce({ data: [pendingRequest] })
      .mockResolvedValueOnce({ data: [] });
    mockedApiClient.post.mockResolvedValue({
      data: { requestId: 'req-1', status: 'denied' },
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

    result.current.deny.mutate('req-1');

    await waitFor(() => {
      expect(result.current.deny.isSuccess).toBe(true);
      expect(result.current.pending.data).toEqual([]);
    });

    expect(mockedApiClient.post).toHaveBeenCalledWith('/access-requests/req-1/deny');
    expect(mockedApiClient.get).toHaveBeenCalledTimes(2);
  });
});
