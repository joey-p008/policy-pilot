import type { JSX } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthSession } from '../context/AuthSessionContext';

export function RequireAuth(): JSX.Element {
  const auth = useAuthSession();
  const location = useLocation();

  if (auth.isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <p role="status">Checking sign-in…</p>
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
