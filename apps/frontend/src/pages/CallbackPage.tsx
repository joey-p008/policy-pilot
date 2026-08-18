import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

export function CallbackPage(): JSX.Element {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <p role="status">Completing sign-in…</p>
      </main>
    );
  }

  if (auth.error != null) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <p className="text-rose-300" role="alert">
          Sign-in failed.
        </p>
        <a className="mt-4 inline-block text-sm text-teal-400 underline" href="/login">
          Try again
        </a>
      </main>
    );
  }

  return <Navigate to="/" replace />;
}
