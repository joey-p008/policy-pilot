/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { PendingAccessRequest } from '@policy-pilot/shared-types';

import { useApproveRequest, useDenyRequest, usePendingRequests } from '../hooks/useAccessRequests';
import { Dashboard } from './Dashboard';

jest.mock('../hooks/useAccessRequests', () => ({
  usePendingRequests: jest.fn(),
  useApproveRequest: jest.fn(),
  useDenyRequest: jest.fn(),
}));

const mockedUsePendingRequests = usePendingRequests as jest.MockedFunction<
  typeof usePendingRequests
>;
const mockedUseApproveRequest = useApproveRequest as jest.MockedFunction<typeof useApproveRequest>;
const mockedUseDenyRequest = useDenyRequest as jest.MockedFunction<typeof useDenyRequest>;

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

function mockMutationIdle() {
  return {
    mutate: jest.fn(),
    isPending: false,
  };
}

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseApproveRequest.mockReturnValue(
      mockMutationIdle() as ReturnType<typeof useApproveRequest>,
    );
    mockedUseDenyRequest.mockReturnValue(mockMutationIdle() as ReturnType<typeof useDenyRequest>);
  });

  it('renders the loading state', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<Dashboard />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading pending requests…');
  });

  it('renders the empty state without crashing', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<Dashboard />);

    expect(screen.getByRole('status')).toHaveTextContent('No pending access requests.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders mock pending request HITL fields', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: [pendingRequest],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<Dashboard />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('req-1')).toBeInTheDocument();
    expect(screen.getByText('prod-postgres-admin')).toBeInTheDocument();
    expect(screen.getByText('prod-postgres-read')).toBeInTheDocument();
    expect(screen.getByText('DENY')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('POL-2026-02 p.4 (Privileged Access)')).toBeInTheDocument();
    expect(screen.getByText('Missing approved change ticket.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Manual Override' })).toBeDisabled();
  });

  it('renders the error state with a retry control', () => {
    const refetch = jest.fn();
    mockedUsePendingRequests.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isSuccess: false,
      error: new Error('Network unavailable'),
      refetch,
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<Dashboard />);

    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
