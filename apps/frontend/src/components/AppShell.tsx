import type { DemoRole } from '@policy-pilot/shared-types';
import type { JSX } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useDemoRole } from '../context/DemoRoleContext';

function navClassName({ isActive }: { isActive: boolean }): string {
  return [
    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100',
  ].join(' ');
}

export function AppShell(): JSX.Element {
  const { role, setRole, isAdmin, identity } = useDemoRole();

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
              Demo RBAC: users submit requests; admins review, decide, and override history.
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
              <p className="text-xs text-slate-400">
                Acting as <span className="font-mono text-slate-200">{identity.actorId}</span> (
                {role})
              </p>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Role
                </span>
                <select
                  value={role}
                  onChange={(event) => {
                    setRole(event.target.value as DemoRole);
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:border-teal-500 focus:outline-none"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </main>
  );
}
