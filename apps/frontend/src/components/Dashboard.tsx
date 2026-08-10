import type { PendingAccessRequest, PolicyCitation } from '@policy-pilot/shared-types';
import { useState, type JSX } from 'react';

import { useApproveRequest, useDenyRequest, usePendingRequests } from '../hooks/useAccessRequests';
import { ConfidenceGauge } from './ConfidenceGauge';
import { DecisionBadge } from './DecisionBadge';
import { PolicyCitationModal } from './PolicyCitationModal';

function citationLabel(citation: PolicyCitation): string {
  return `${citation.documentId} p.${citation.pageNumber} (${citation.sectionTitle})`;
}

function EntitlementsExpander({ request }: { request: PendingAccessRequest }): JSX.Element {
  return (
    <details className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-slate-200">
        Compare current entitlements vs requested permission
      </summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Current entitlements
          </h3>
          {request.currentEntitlements.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              {request.currentEntitlements.map((entitlement) => (
                <li key={entitlement}>{entitlement}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">None</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Requested permission
          </h3>
          <p className="text-sm font-medium text-teal-300">{request.targetEntitlement}</p>
        </div>
      </div>
    </details>
  );
}

function RequestCard({
  request,
  actionsDisabled,
  onApprove,
  onDeny,
  onOpenCitation,
}: {
  request: PendingAccessRequest;
  actionsDisabled: boolean;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onOpenCitation: (citation: PolicyCitation) => void;
}): JSX.Element {
  return (
    <article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs text-slate-400">{request.requestId}</p>
          <h2 className="text-lg font-semibold text-slate-100">{request.targetEntitlement}</h2>
        </div>
        <DecisionBadge decision={request.recommendation.decision} />
      </div>

      <ConfidenceGauge score={request.recommendation.confidenceScore} />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rationale</h3>
        <p className="text-sm leading-relaxed text-slate-200">{request.recommendation.rationale}</p>
      </div>

      <EntitlementsExpander request={request} />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Policy citations
        </h3>
        {request.recommendation.policyCitations.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {request.recommendation.policyCitations.map((citation) => (
              <li key={`${citation.documentId}-${citation.pageNumber}-${citation.sectionTitle}`}>
                <button
                  type="button"
                  className="text-left text-sm text-teal-300 underline decoration-teal-700 underline-offset-2 hover:text-teal-200"
                  onClick={() => {
                    onOpenCitation(citation);
                  }}
                >
                  {citationLabel(citation)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">None</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
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
    </article>
  );
}

function PendingRequestsList({
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
  const [activeCitation, setActiveCitation] = useState<PolicyCitation | null>(null);
  const actionsDisabled = approvePending || denyPending;

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => (
          <RequestCard
            key={request.requestId}
            request={request}
            actionsDisabled={actionsDisabled}
            onApprove={onApprove}
            onDeny={onDeny}
            onOpenCitation={setActiveCitation}
          />
        ))}
      </div>
      {activeCitation !== null ? (
        <PolicyCitationModal
          citation={activeCitation}
          onClose={() => {
            setActiveCitation(null);
          }}
        />
      ) : null}
    </>
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
      <PendingRequestsList
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
    <div className="mx-auto max-w-4xl space-y-6">
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
