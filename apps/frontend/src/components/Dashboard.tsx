import type { PendingAccessRequest, PolicyCitation } from '@policy-pilot/shared-types';
import type { JSX } from 'react';

import { useApproveRequest, useDenyRequest, usePendingRequests } from '../hooks/useAccessRequests';

const RATIONALE_PREVIEW_LENGTH = 120;

function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function formatCitations(citations: PolicyCitation[]): string {
  if (citations.length === 0) {
    return 'None';
  }

  return citations
    .map((citation) => `${citation.documentId} p.${citation.pageNumber} (${citation.sectionTitle})`)
    .join('; ');
}

function truncateRationale(rationale: string): string {
  if (rationale.length <= RATIONALE_PREVIEW_LENGTH) {
    return rationale;
  }

  return `${rationale.slice(0, RATIONALE_PREVIEW_LENGTH)}…`;
}

function PendingRequestsTable({
  requests,
  approvePending,
  denyPending,
  onApprove,
  onDeny,
}: {
  requests: PendingAccessRequest[];
  approvePending: boolean;
  denyPending: boolean;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
        <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Request ID</th>
            <th className="px-4 py-3 font-medium">Target entitlement</th>
            <th className="px-4 py-3 font-medium">Current entitlements</th>
            <th className="px-4 py-3 font-medium">AI decision</th>
            <th className="px-4 py-3 font-medium">Confidence</th>
            <th className="px-4 py-3 font-medium">Citations</th>
            <th className="px-4 py-3 font-medium">Rationale</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {requests.map((request) => {
            const actionsDisabled = approvePending || denyPending;

            return (
              <tr key={request.requestId} className="align-top text-slate-200">
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{request.requestId}</td>
                <td className="px-4 py-3">{request.targetEntitlement}</td>
                <td className="px-4 py-3">
                  {request.currentEntitlements.length > 0
                    ? request.currentEntitlements.join(', ')
                    : 'None'}
                </td>
                <td className="px-4 py-3 font-medium text-teal-300">
                  {request.recommendation.decision}
                </td>
                <td className="px-4 py-3">
                  {formatConfidence(request.recommendation.confidenceScore)}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {formatCitations(request.recommendation.policyCitations)}
                </td>
                <td
                  className="max-w-xs px-4 py-3 text-slate-300"
                  title={request.recommendation.rationale}
                >
                  {truncateRationale(request.recommendation.rationale)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionsDisabled}
                      onClick={() => {
                        onApprove(request.requestId);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={actionsDisabled}
                      onClick={() => {
                        onDeny(request.requestId);
                      }}
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled
                      title="Manual Override is not available yet"
                    >
                      Manual Override
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard(): JSX.Element {
  const { data, isPending, isError, error, refetch, isSuccess } = usePendingRequests();
  const approve = useApproveRequest();
  const deny = useDenyRequest();

  let body: JSX.Element;

  if (isPending) {
    body = (
      <p className="text-slate-300" role="status" aria-live="polite">
        Loading pending requests…
      </p>
    );
  } else if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load pending requests.';
    body = (
      <div className="space-y-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-4">
        <p className="text-rose-200" role="alert">
          {message}
        </p>
        <button
          type="button"
          className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white"
          onClick={() => {
            void refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  } else if (isSuccess && data.length === 0) {
    body = (
      <p className="text-slate-300" role="status">
        No pending access requests.
      </p>
    );
  } else {
    body = (
      <PendingRequestsTable
        requests={data ?? []}
        approvePending={approve.isPending}
        denyPending={deny.isPending}
        onApprove={(requestId) => {
          approve.mutate(requestId);
        }}
        onDeny={(requestId) => {
          deny.mutate(requestId);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">Policy-Pilot</p>
        <h1 className="text-3xl font-semibold tracking-tight">HITL Dashboard</h1>
        <p className="text-slate-300">
          Review AI recommendations, policy citations, and current entitlements before approving or
          denying access.
        </p>
      </header>
      {body}
    </div>
  );
}
