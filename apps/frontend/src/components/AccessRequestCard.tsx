import type {
  AccessRequestHistoryItem,
  PendingAccessRequest,
  PolicyCitation,
} from '@policy-pilot/shared-types';
import { useState, type JSX } from 'react';

import { ConfidenceGauge } from './ConfidenceGauge';
import { DecisionBadge } from './DecisionBadge';
import { PolicyCitationModal } from './PolicyCitationModal';
import { RequestDecisionActions } from './RequestDecisionActions';

function citationLabel(citation: PolicyCitation): string {
  return `${citation.documentId} p.${citation.pageNumber} (${citation.sectionTitle})`;
}

function EntitlementsExpander({
  currentEntitlements,
  systemName,
  targetEntitlement,
  justification,
}: {
  currentEntitlements: string[];
  systemName: string;
  targetEntitlement: string;
  justification: string;
}): JSX.Element {
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
          {currentEntitlements.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
              {currentEntitlements.map((entitlement) => (
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
          <p className="text-sm font-medium text-teal-300">
            {systemName} / {targetEntitlement}
          </p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Justification</p>
          <p className="text-sm text-slate-300">{justification}</p>
        </div>
      </div>
    </details>
  );
}

export function AccessRequestCard({
  request,
  actionsDisabled,
  historyStatus,
  onApprove,
  onDeny,
  onEscalate,
}: {
  request: PendingAccessRequest | AccessRequestHistoryItem;
  actionsDisabled: boolean;
  historyStatus?: AccessRequestHistoryItem['status'];
  onApprove: (requestId: string) => void;
  onDeny: (requestId: string) => void;
  onEscalate: (requestId: string) => void;
}): JSX.Element {
  const [activeCitation, setActiveCitation] = useState<PolicyCitation | null>(null);

  return (
    <>
      <article className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-xs text-slate-400">{request.requestId}</p>
            <h2 className="text-lg font-semibold text-slate-100">
              {request.systemName} / {request.targetEntitlement}
            </h2>
            <p className="text-sm text-slate-400">
              {request.title} · {request.department} ·{' '}
              <span className="font-mono text-slate-300">{request.costCenter}</span>
            </p>
            {historyStatus !== undefined ? (
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Status: <span className="font-semibold text-slate-200">{historyStatus}</span>
              </p>
            ) : null}
          </div>
          <DecisionBadge decision={request.recommendation.decision} />
        </div>

        <ConfidenceGauge score={request.recommendation.confidenceScore} />

        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rationale
          </h3>
          <p className="text-sm leading-relaxed text-slate-200">
            {request.recommendation.rationale}
          </p>
        </div>

        <EntitlementsExpander
          currentEntitlements={request.currentEntitlements}
          systemName={request.systemName}
          targetEntitlement={request.targetEntitlement}
          justification={request.justification}
        />

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
                      setActiveCitation(citation);
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

        <RequestDecisionActions
          actionsDisabled={actionsDisabled}
          currentStatus={historyStatus ?? 'PENDING_REVIEW'}
          onApprove={() => {
            onApprove(request.requestId);
          }}
          onDeny={() => {
            onDeny(request.requestId);
          }}
          onEscalate={() => {
            onEscalate(request.requestId);
          }}
        />
      </article>
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
