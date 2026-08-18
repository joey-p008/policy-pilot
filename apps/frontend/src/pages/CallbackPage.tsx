import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { isOidcConfigured } from '../lib/oidc-config';

function signInErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Sign-in failed.';
}

export function CallbackPage(): JSX.Element {
  if (!isOidcConfigured()) {
    return <Navigate to="/login" replace />;
  }

  return <OidcCallbackPage />;
}

function OidcCallbackPage(): JSX.Element {
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
          {signInErrorMessage(auth.error)}
        </p>
        <a className="mt-4 inline-block text-sm text-teal-400 underline" href="/login">
          Try again
        </a>
      </main>
    );
  }

  return <Navigate to="/" replace />;
}
