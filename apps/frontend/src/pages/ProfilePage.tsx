import { useState, type FormEvent, type JSX } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useRequesterProfile } from '../context/RequesterProfileContext';

export function ProfilePage(): JSX.Element {
  const { profile, isComplete, setProfile } = useRequesterProfile();
  const navigate = useNavigate();
  const [title, setTitle] = useState(profile?.title ?? '');
  const [department, setDepartment] = useState(profile?.department ?? '');
  const [costCenter, setCostCenter] = useState(profile?.costCenter ?? '');
  const [submitted, setSubmitted] = useState(false);

  const trimmedTitle = title.trim();
  const trimmedDepartment = department.trim();
  const trimmedCostCenter = costCenter.trim();
  const canSubmit =
    trimmedTitle.length > 0 && trimmedDepartment.length > 0 && trimmedCostCenter.length > 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setProfile({
      title: trimmedTitle,
      department: trimmedDepartment,
      costCenter: trimmedCostCenter,
    });
    setSubmitted(true);
    navigate('/', { replace: true });
  };

  if (submitted && isComplete) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-lg space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">
            Policy-Pilot
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Requester profile</h1>
          <p className="text-slate-300">
            Specify your title, department, and cost center before using the access request console.
            These fields are sent with every ticket and used by the policy agent.
          </p>
        </header>

        <form
          className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5"
          onSubmit={handleSubmit}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              placeholder="e.g. Data Analyst"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Department
            </span>
            <input
              type="text"
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
              }}
              placeholder="e.g. Finance Analytics"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cost center
            </span>
            <input
              type="text"
              value={costCenter}
              onChange={(event) => {
                setCostCenter(event.target.value);
              }}
              placeholder="e.g. CC-FIN-07"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isComplete ? 'Save profile' : 'Continue'}
          </button>
        </form>
      </div>
    </main>
  );
}
