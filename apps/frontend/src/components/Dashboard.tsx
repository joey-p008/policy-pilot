import type { PendingAccessRequest, PolicyCitation } from '@policy-pilot/shared-types';
import { useState, type FormEvent, type JSX } from 'react';

import { MOCK_HITL_ADMIN_ID } from '../api/hitl-constants';
import {
  useApproveRequest,
  useDenyRequest,
  useEscalateRequest,
  usePendingRequests,
  useSubmitAccessRequest,
} from '../hooks/useAccessRequests';
import { ConfidenceGauge } from './ConfidenceGauge';
import { DecisionBadge } from './DecisionBadge';
import { PolicyCitationModal } from './PolicyCitationModal';

function citationLabel(citation: PolicyCitation): string {
  return `${citation.documentId} p.${citation.pageNumber} (${citation.sectionTitle})`;
}

function buildDecisionPayload(requestId: string) {
  return {
    requestId,
    admin_id: MOCK_HITL_ADMIN_ID,
  };
}

function RequestSubmitForm({
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (payload: { targetEntitlement: string; justification: string }) => void;
}): JSX.Element {
  const [targetEntitlement, setTargetEntitlement] = useState('');
  const [justification, setJustification] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const trimmedEntitlement = targetEntitlement.trim();
    const trimmedJustification = justification.trim();
    if (trimmedEntitlement.length === 0 || trimmedJustification.length === 0) {
      return;
    }
    onSubmit({
      targetEntitlement: trimmedEntitlement,
      justification: trimmedJustification,
    });
  };

  return (
    <form
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">Submit access request</h2>
        <p className="text-sm text-slate-400">
          The agent retrieves policy context and returns a structured recommendation for HITL
          review.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Target entitlement
        </span>
        <input
          type="text"
          value={targetEntitlement}
          onChange={(event) => {
            setTargetEntitlement(event.target.value);
          }}
          disabled={isSubmitting}
          placeholder="e.g. prod-postgres-admin"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Business justification
        </span>
        <textarea
          value={justification}
          onChange={(event) => {
            setJustification(event.target.value);
          }}
          disabled={isSubmitting}
          rows={3}
          placeholder="Explain why this access is needed…"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
        />
      </label>
      {errorMessage !== null ? (
        <p className="text-sm text-rose-300" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            targetEntitlement.trim().length === 0 ||
            justification.trim().length === 0
          }
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Generating recommendation…' : 'Submit for recommendation'}
        </button>
        {isSubmitting ? (
          <p className="text-sm text-slate-400" role="status" aria-live="polite">
            Running retrieval and decision engine…
          </p>
        ) : null}
      </div>
    </form>
  );
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
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Justification</p>
          <p className="text-sm text-slate-300">{request.justification}</p>
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
  onEscalate,
  onOpenCitation,
}: {
  request: PendingAccessRequest;
  actionsDisabled: boolean;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onEscalate: (requestId: string) => void;
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
          Approve Recommendation
        </button>
        <button
          type="button"
          className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={actionsDisabled}
          onClick={() => {
            onDeny(request.requestId);
          }}
        >
          Deny Request
        </button>
        <button
          type="button"
          className="rounded border border-amber-700/80 px-3 py-1.5 text-xs font-medium text-amber-200 hover:border-amber-500 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={actionsDisabled}
          onClick={() => {
            onEscalate(request.requestId);
          }}
        >
          Escalate
        </button>
      </div>
    </article>
  );
}

function PendingRequestsList({
  requests,
  actionsDisabled,
  onApprove,
  onDeny,
  onEscalate,
}: {
  requests: PendingAccessRequest[];
  actionsDisabled: boolean;
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onEscalate: (requestId: string) => void;
}): JSX.Element {
  const [activeCitation, setActiveCitation] = useState<PolicyCitation | null>(null);

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
            onEscalate={onEscalate}
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

function mutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return fallback;
}

export function Dashboard(): JSX.Element {
  const { data, isPending, isError, error, refetch, isSuccess } = usePendingRequests();
  const submit = useSubmitAccessRequest();
  const approve = useApproveRequest();
  const deny = useDenyRequest();
  const escalate = useEscalateRequest();

  const decisionError =
    approve.error !== null
      ? mutationErrorMessage(approve.error, 'Failed to approve access request.')
      : deny.error !== null
        ? mutationErrorMessage(deny.error, 'Failed to deny access request.')
        : escalate.error !== null
          ? mutationErrorMessage(escalate.error, 'Failed to escalate access request.')
          : null;

  const submitError =
    submit.error !== null
      ? mutationErrorMessage(submit.error, 'Failed to generate recommendation.')
      : null;

  const actionsDisabled = approve.isPending || deny.isPending || escalate.isPending;

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
  } else if (isSuccess && (data?.length ?? 0) === 0) {
    body = (
      <p className="text-slate-300" role="status">
        No pending access requests.
      </p>
    );
  } else {
    body = (
      <PendingRequestsList
        requests={data ?? []}
        actionsDisabled={actionsDisabled}
        onApprove={(requestId) => {
          deny.reset();
          escalate.reset();
          approve.mutate(buildDecisionPayload(requestId));
        }}
        onDeny={(requestId) => {
          approve.reset();
          escalate.reset();
          deny.mutate(buildDecisionPayload(requestId));
        }}
        onEscalate={(requestId) => {
          approve.reset();
          deny.reset();
          escalate.mutate(buildDecisionPayload(requestId));
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
          Submit an access request for a live agent recommendation, then approve, deny, or escalate.
        </p>
      </header>
      <RequestSubmitForm
        isSubmitting={submit.isPending}
        errorMessage={submitError}
        onSubmit={(payload) => {
          submit.mutate(payload, {
            onSuccess: () => {
              submit.reset();
            },
          });
        }}
      />
      {decisionError !== null ? (
        <div className="space-y-3 rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-4">
          <p className="text-rose-200" role="alert">
            {decisionError}
          </p>
          <button
            type="button"
            className="rounded bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-white"
            onClick={() => {
              approve.reset();
              deny.reset();
              escalate.reset();
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {body}
    </div>
  );
}
