import { useState, type FormEvent, type JSX } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { useRequesterProfile } from '../context/RequesterProfileContext';
import {
  isRequesterProfileComplete,
  REQUESTER_COST_CENTERS,
  REQUESTER_DEPARTMENTS,
  REQUESTER_TITLES,
  selectRequesterProfileValue,
} from '../lib/requester-profile';

const SELECT_CLASS_NAME =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none';

export function ProfilePage(): JSX.Element {
  const { profile, isComplete, setProfile } = useRequesterProfile();
  const navigate = useNavigate();
  const [title, setTitle] = useState(() =>
    selectRequesterProfileValue(profile?.title, REQUESTER_TITLES),
  );
  const [department, setDepartment] = useState(() =>
    selectRequesterProfileValue(profile?.department, REQUESTER_DEPARTMENTS),
  );
  const [costCenter, setCostCenter] = useState(() =>
    selectRequesterProfileValue(profile?.costCenter, REQUESTER_COST_CENTERS),
  );
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = isRequesterProfileComplete({ title, department, costCenter });

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setProfile({
      title,
      department,
      costCenter,
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
            <select
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
              }}
              className={SELECT_CLASS_NAME}
            >
              <option value="">Select title</option>
              {REQUESTER_TITLES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Department
            </span>
            <select
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value);
              }}
              className={SELECT_CLASS_NAME}
            >
              <option value="">Select department</option>
              {REQUESTER_DEPARTMENTS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Cost center
            </span>
            <select
              value={costCenter}
              onChange={(event) => {
                setCostCenter(event.target.value);
              }}
              className={`${SELECT_CLASS_NAME} font-mono`}
            >
              <option value="">Select cost center</option>
              {REQUESTER_COST_CENTERS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
