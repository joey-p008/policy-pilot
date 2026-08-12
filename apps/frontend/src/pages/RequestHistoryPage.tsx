import type { JSX } from 'react';

import { AccessRequestCard } from '../components/AccessRequestCard';
import {
  useApproveRequest,
  useDenyRequest,
  useEscalateRequest,
  useRequestHistory,
} from '../hooks/useAccessRequests';
import { mutationErrorMessage } from '../lib/mutation-error';

export function RequestHistoryPage(): JSX.Element {
  const { data, isPending, isError, error, refetch, isSuccess } = useRequestHistory();
  const approve = useApproveRequest();
  const deny = useDenyRequest();
  const escalate = useEscalateRequest();

  const decisionError =
    approve.error !== null
      ? mutationErrorMessage(approve.error, 'Failed to override approval.')
      : deny.error !== null
        ? mutationErrorMessage(deny.error, 'Failed to override denial.')
        : escalate.error !== null
          ? mutationErrorMessage(escalate.error, 'Failed to override escalation.')
          : null;

  const actionsDisabled = approve.isPending || deny.isPending || escalate.isPending;

  let body: JSX.Element;

  if (isPending) {
    body = (
      <p className="text-slate-300" role="status" aria-live="polite">
        Loading request history…
      </p>
    );
  } else if (isError) {
    const message = error instanceof Error ? error.message : 'Failed to load request history.';
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
        No decided access requests yet.
      </p>
    );
  } else {
    body = (
      <div className="space-y-4">
        {(data ?? []).map((request) => (
          <div key={request.requestId} className="space-y-2">
            <p className="text-xs text-slate-400">
              Decided {new Date(request.decidedAt).toLocaleString()}
              {request.decidedByAdminId !== null ? ` by ${request.decidedByAdminId}` : ''}
            </p>
            <AccessRequestCard
              request={request}
              historyStatus={request.status}
              provisioningStatus={request.provisioningStatus}
              actionsDisabled={actionsDisabled}
              onApprove={(requestId) => {
                deny.reset();
                escalate.reset();
                approve.mutate({ requestId });
              }}
              onDeny={(requestId) => {
                approve.reset();
                escalate.reset();
                deny.mutate({ requestId });
              }}
              onEscalate={(requestId) => {
                approve.reset();
                deny.reset();
                escalate.mutate({ requestId });
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-100">Request history</h2>
        <p className="text-sm text-slate-400">
          Review decided requests and override Approve / Deny / Escalate outcomes.
        </p>
      </div>
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
