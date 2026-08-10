import { useState, type FormEvent, type JSX } from 'react';

export function RequestSubmitForm({
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
    setTargetEntitlement('');
    setJustification('');
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
