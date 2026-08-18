import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuthSession } from '../context/AuthSessionContext';
import { useRequesterProfile } from '../context/RequesterProfileContext';

function navClassName({ isActive }: { isActive: boolean }): string {
  return [
    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100',
  ].join(' ');
}

export function AppShell(): JSX.Element {
  const { role, isAdmin, session, signOut } = useAuthSession();
  const { profile } = useRequesterProfile();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-400">
              Policy-Pilot
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Access Request Console</h1>
            <p className="text-slate-300">
              Signed-in users submit requests; admins review, decide, and override history.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
            <nav className="flex flex-wrap gap-2" aria-label="Primary">
              <NavLink to="/" end className={navClassName}>
                Submit
              </NavLink>
              {isAdmin ? (
                <>
                  <NavLink to="/review" className={navClassName}>
                    Review
                  </NavLink>
                  <NavLink to="/history" className={navClassName}>
                    History
                  </NavLink>
                </>
              ) : null}
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              {profile !== null ? (
                <p className="text-xs text-slate-400">
                  {profile.title} · {profile.department} ·{' '}
                  <span className="font-mono text-slate-200">{profile.costCenter}</span>
                </p>
              ) : null}
              <NavLink to="/profile" className={navClassName}>
                Profile
              </NavLink>
              <p className="text-xs text-slate-400">
                {session !== null ? (
                  <>
                    Signed in as{' '}
                    <span className="font-mono text-slate-200">
                      {session.subject.length > 0 ? session.subject : session.actorId}
                    </span>{' '}
                    ({role})
                  </>
                ) : (
                  'Signed in, but this account has no Policy-Pilot role claim'
                )}
              </p>
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                onClick={() => {
                  void signOut();
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </main>
  );
}
