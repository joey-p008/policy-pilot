import type { JSX } from 'react';

export function RequestDecisionActions({
  actionsDisabled,
  currentStatus,
  onApprove,
  onDeny,
  onEscalate,
}: {
  actionsDisabled: boolean;
  currentStatus?: 'APPROVED' | 'DENIED' | 'ESCALATED' | 'PENDING_REVIEW';
  onApprove: () => void;
  onDeny: () => void;
  onEscalate: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-4">
      <button
        type="button"
        className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={actionsDisabled || currentStatus === 'APPROVED'}
        onClick={onApprove}
      >
        {currentStatus === undefined || currentStatus === 'PENDING_REVIEW'
          ? 'Approve Recommendation'
          : 'Override to Approve'}
      </button>
      <button
        type="button"
        className="rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={actionsDisabled || currentStatus === 'DENIED'}
        onClick={onDeny}
      >
        {currentStatus === undefined || currentStatus === 'PENDING_REVIEW'
          ? 'Deny Request'
          : 'Override to Deny'}
      </button>
      <button
        type="button"
        className="rounded border border-amber-700/80 px-3 py-1.5 text-xs font-medium text-amber-200 hover:border-amber-500 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={actionsDisabled || currentStatus === 'ESCALATED'}
        onClick={onEscalate}
      >
        {currentStatus === undefined || currentStatus === 'PENDING_REVIEW'
          ? 'Escalate'
          : 'Override to Escalate'}
      </button>
    </div>
  );
}
