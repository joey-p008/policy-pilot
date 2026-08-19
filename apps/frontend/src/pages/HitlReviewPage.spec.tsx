/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';

import {
  useApproveRequest,
  useDenyRequest,
  useEscalateRequest,
  usePendingRequests,
} from '../hooks/useAccessRequests';
import { MOCK_PENDING_ACCESS_REQUESTS } from '../mocks/pending-access-requests';
import { HitlReviewPage } from './HitlReviewPage';

jest.mock('../hooks/useAccessRequests', () => ({
  usePendingRequests: jest.fn(),
  useApproveRequest: jest.fn(),
  useDenyRequest: jest.fn(),
  useEscalateRequest: jest.fn(),
}));

const mockedUsePendingRequests = usePendingRequests as jest.MockedFunction<
  typeof usePendingRequests
>;
const mockedUseApproveRequest = useApproveRequest as jest.MockedFunction<typeof useApproveRequest>;
const mockedUseDenyRequest = useDenyRequest as jest.MockedFunction<typeof useDenyRequest>;
const mockedUseEscalateRequest = useEscalateRequest as jest.MockedFunction<
  typeof useEscalateRequest
>;

const [denyRequest] = MOCK_PENDING_ACCESS_REQUESTS;

if (denyRequest === undefined) {
  throw new Error('Expected MOCK_PENDING_ACCESS_REQUESTS to include at least one fixture row');
}

function mockMutationIdle() {
  return {
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
  };
}

describe('HitlReviewPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseApproveRequest.mockReturnValue(
      mockMutationIdle() as ReturnType<typeof useApproveRequest>,
    );
    mockedUseDenyRequest.mockReturnValue(mockMutationIdle() as ReturnType<typeof useDenyRequest>);
    mockedUseEscalateRequest.mockReturnValue(
      mockMutationIdle() as ReturnType<typeof useEscalateRequest>,
    );
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

    render(<HitlReviewPage />);

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

    render(<HitlReviewPage />);

    expect(screen.getByRole('status')).toHaveTextContent('No pending access requests.');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('renders structured RAG recommendation UI from mock data', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: [denyRequest],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<HitlReviewPage />);

    const card = screen.getByRole('article');
    expect(within(card).getByText('DENY')).toBeInTheDocument();
    expect(screen.getByLabelText('Confidence 91%')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Confidence score' })).toHaveAttribute(
      'aria-valuenow',
      '91',
    );
    expect(screen.getByText(denyRequest.recommendation.rationale)).toBeInTheDocument();
    expect(
      screen.getByText('Proposed tool: propose_access_decision · awaiting human approval'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve Recommendation' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Deny Request' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Escalate' })).toBeEnabled();
  });

  it('fires approve, deny, and escalate mutations with requestId only', () => {
    const approveMutate = jest.fn();
    const denyMutate = jest.fn();
    const escalateMutate = jest.fn();

    mockedUsePendingRequests.mockReturnValue({
      data: [denyRequest],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);
    mockedUseApproveRequest.mockReturnValue({
      mutate: approveMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useApproveRequest>);
    mockedUseDenyRequest.mockReturnValue({
      mutate: denyMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useDenyRequest>);
    mockedUseEscalateRequest.mockReturnValue({
      mutate: escalateMutate,
      reset: jest.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useEscalateRequest>);

    render(<HitlReviewPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Approve Recommendation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deny Request' }));
    fireEvent.click(screen.getByRole('button', { name: 'Escalate' }));

    expect(approveMutate).toHaveBeenCalledWith({
      requestId: denyRequest.requestId,
    });
    expect(denyMutate).toHaveBeenCalledWith({
      requestId: denyRequest.requestId,
    });
    expect(escalateMutate).toHaveBeenCalledWith({
      requestId: denyRequest.requestId,
    });
  });

  it('expands entitlements comparison for current vs requested', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: [denyRequest],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    render(<HitlReviewPage />);

    fireEvent.click(screen.getByText('Compare current entitlements vs requested permission'));

    expect(screen.getByText('Current entitlements')).toBeInTheDocument();
    expect(screen.getByText('prod-postgres-read')).toBeInTheDocument();
    expect(screen.getByText('staging-postgres-write')).toBeInTheDocument();
    expect(screen.getByText('Requested permission')).toBeInTheDocument();
    expect(screen.getAllByText('DATA_WAREHOUSE / prod-postgres-admin').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Need production admin to restart a failed migration job.'),
    ).toBeInTheDocument();
  });

  it('opens a citation modal with policy chunk content', () => {
    mockedUsePendingRequests.mockReturnValue({
      data: [denyRequest],
      isPending: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof usePendingRequests>);

    const firstCitation = denyRequest.recommendation.policyCitations[0];
    if (firstCitation === undefined || firstCitation.content === undefined) {
      throw new Error('Expected mock citation with content');
    }

    render(<HitlReviewPage />);

    fireEvent.click(
      screen.getByRole('button', {
        name: 'POL-2026-02 p.4 (Privileged Access)',
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/POL-2026-02 · p\.4 · Privileged Access/)).toBeInTheDocument();
    expect(within(dialog).getByText(firstCitation.content)).toBeInTheDocument();
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

    render(<HitlReviewPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Network unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
