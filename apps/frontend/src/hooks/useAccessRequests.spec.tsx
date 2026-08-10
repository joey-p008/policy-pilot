/** @jest-environment jsdom */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PendingAccessRequest } from '@policy-pilot/shared-types';
import type { JSX, ReactNode } from 'react';

import {
  ACCESS_REQUESTS_HISTORY_QUERY_KEY,
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
} from '../api/access-request-keys';
import {
  approveAccessRequest,
  createAccessRequest,
  denyAccessRequest,
  escalateAccessRequest,
  fetchAccessRequestHistory,
  fetchPendingAccessRequests,
} from '../api/access-requests';
import { DemoRoleProvider } from '../context/DemoRoleContext';
import { setDemoIdentity } from '../lib/demo-identity';
import {
  useApproveRequest,
  useDenyRequest,
  useEscalateRequest,
  usePendingRequests,
  useRequestHistory,
  useSubmitAccessRequest,
} from './useAccessRequests';

jest.mock('../api/access-requests', () => ({
  fetchPendingAccessRequests: jest.fn(),
  fetchAccessRequestHistory: jest.fn(),
  createAccessRequest: jest.fn(),
  approveAccessRequest: jest.fn(),
  denyAccessRequest: jest.fn(),
  escalateAccessRequest: jest.fn(),
}));

const mockedFetchPendingAccessRequests = fetchPendingAccessRequests as jest.MockedFunction<
  typeof fetchPendingAccessRequests
>;
const mockedFetchAccessRequestHistory = fetchAccessRequestHistory as jest.MockedFunction<
  typeof fetchAccessRequestHistory
>;
const mockedCreateAccessRequest = createAccessRequest as jest.MockedFunction<
  typeof createAccessRequest
>;
const mockedApproveAccessRequest = approveAccessRequest as jest.MockedFunction<
  typeof approveAccessRequest
>;
const mockedDenyAccessRequest = denyAccessRequest as jest.MockedFunction<typeof denyAccessRequest>;
const mockedEscalateAccessRequest = escalateAccessRequest as jest.MockedFunction<
  typeof escalateAccessRequest
>;

const pendingRequest: PendingAccessRequest = {
  requestId: 'req-1',
  employeeId: 'emp-hashed',
  targetEntitlement: 'prod-postgres-admin',
  justification: 'Need admin for deploy',
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
    return (
      <QueryClientProvider client={queryClient}>
        <DemoRoleProvider>{children}</DemoRoleProvider>
      </QueryClientProvider>
    );
  };
}

describe('useAccessRequests hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDemoIdentity('admin');
  });

  it('loads pending access requests for admin', async () => {
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

  it('does not fetch pending requests for user role', async () => {
    setDemoIdentity('user');
    mockedFetchPendingAccessRequests.mockResolvedValue([pendingRequest]);

    const { result } = renderHook(() => usePendingRequests(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockedFetchPendingAccessRequests).not.toHaveBeenCalled();
  });

  it('loads history for admin', async () => {
    mockedFetchAccessRequestHistory.mockResolvedValue([]);

    const { result } = renderHook(() => useRequestHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetchAccessRequestHistory).toHaveBeenCalledTimes(1);
    expect(ACCESS_REQUESTS_HISTORY_QUERY_KEY).toEqual(['access-requests', 'history']);
  });

  it('submits a new request and prepends it to the pending cache for admin', async () => {
    mockedFetchPendingAccessRequests.mockResolvedValueOnce([]).mockResolvedValue([pendingRequest]);
    mockedCreateAccessRequest.mockResolvedValue(pendingRequest);

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        submit: useSubmitAccessRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.submit.mutate({
      targetEntitlement: 'prod-postgres-admin',
      justification: 'Need admin for deploy',
    });

    await waitFor(() => {
      expect(result.current.submit.isSuccess).toBe(true);
      expect(result.current.pending.data?.[0]?.requestId).toBe('req-1');
    });

    expect(mockedCreateAccessRequest).toHaveBeenCalledWith({
      targetEntitlement: 'prod-postgres-admin',
      justification: 'Need admin for deploy',
    });
  });

  it('approves a request and invalidates the pending list', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedFetchAccessRequestHistory.mockResolvedValue([]);
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
  });

  it('denies a request and invalidates the pending list', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedFetchAccessRequestHistory.mockResolvedValue([]);
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
  });

  it('escalates a request and invalidates the pending list', async () => {
    mockedFetchPendingAccessRequests
      .mockResolvedValueOnce([pendingRequest])
      .mockResolvedValueOnce([]);
    mockedFetchAccessRequestHistory.mockResolvedValue([]);
    mockedEscalateAccessRequest.mockResolvedValue({
      requestId: 'req-1',
      status: 'escalated',
    });

    const { result } = renderHook(
      () => ({
        pending: usePendingRequests(),
        escalate: useEscalateRequest(),
      }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.pending.isSuccess).toBe(true);
    });

    result.current.escalate.mutate(decisionPayload);

    await waitFor(() => {
      expect(result.current.escalate.isSuccess).toBe(true);
      expect(result.current.pending.data).toEqual([]);
    });

    expect(mockedEscalateAccessRequest).toHaveBeenCalledWith(decisionPayload, expect.anything());
  });
});
