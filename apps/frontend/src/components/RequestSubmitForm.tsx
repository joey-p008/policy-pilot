import { useState, type FormEvent, type JSX } from 'react';

import {
  ACCESS_REQUEST_ENTITLEMENT_KEYS,
  ACCESS_REQUEST_SYSTEM_NAMES,
  isAccessRequestCatalogMember,
} from '../lib/access-request-options';

const SELECT_CLASS_NAME =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500 focus:outline-none';

export function RequestSubmitForm({
  isSubmitting,
  errorMessage,
  onSubmit,
}: {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (payload: {
    systemName: string;
    entitlementKey: string;
    justification: string;
  }) => void;
}): JSX.Element {
  const [systemName, setSystemName] = useState('');
  const [entitlementKey, setEntitlementKey] = useState('');
  const [justification, setJustification] = useState('');

  const trimmedJustification = justification.trim();
  const canSubmitTicket =
    isAccessRequestCatalogMember(systemName, ACCESS_REQUEST_SYSTEM_NAMES) &&
    isAccessRequestCatalogMember(entitlementKey, ACCESS_REQUEST_ENTITLEMENT_KEYS) &&
    trimmedJustification.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmitTicket) {
      return;
    }
    onSubmit({
      systemName,
      entitlementKey,
      justification: trimmedJustification,
    });
    setSystemName('');
    setEntitlementKey('');
    setJustification('');
  };

  const submitDisabled = isSubmitting || !canSubmitTicket;

  return (
    <form
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5"
      onSubmit={handleSubmit}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-100">Submit access request</h2>
        <p className="text-sm text-slate-400">
          The agent retrieves policy context from your profile and ticket fields, then returns a
          structured recommendation for HITL review.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          System name
        </span>
        <select
          value={systemName}
          onChange={(event) => {
            setSystemName(event.target.value);
          }}
          disabled={isSubmitting}
          className={SELECT_CLASS_NAME}
        >
          <option value="">Select system name</option>
          {ACCESS_REQUEST_SYSTEM_NAMES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Entitlement key
        </span>
        <select
          value={entitlementKey}
          onChange={(event) => {
            setEntitlementKey(event.target.value);
          }}
          disabled={isSubmitting}
          className={SELECT_CLASS_NAME}
        >
          <option value="">Select entitlement key</option>
          {ACCESS_REQUEST_ENTITLEMENT_KEYS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
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
          disabled={submitDisabled}
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
