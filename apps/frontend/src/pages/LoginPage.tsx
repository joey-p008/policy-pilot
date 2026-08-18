import { useEffect, type JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { useAuthSession } from '../context/AuthSessionContext';
import { isOidcConfigured } from '../lib/oidc-config';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function redirectPathFromState(state: unknown): string {
  if (!isRecord(state)) {
    return '/';
  }
  const from = state.from;
  if (typeof from === 'string' && from.startsWith('/')) {
    return from;
  }
  return '/';
}

function signInErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return 'Sign-in failed.';
}

function LocalLoginPage(): JSX.Element {
  const { isAuthenticated, signInWithRole } = useAuthSession();
  const location = useLocation();

  if (isAuthenticated) {
    return <Navigate to={redirectPathFromState(location.state)} replace />;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-slate-300">
          No OIDC tenant is configured, so this local session maps onto the seeded HITL user or
          admin principal. Set real <span className="font-mono">VITE_OIDC_*</span> values to use
          Authorization Code + PKCE.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => {
              signInWithRole?.('user');
            }}
          >
            Continue as user
          </button>
          <button
            type="button"
            className="rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100"
            onClick={() => {
              signInWithRole?.('admin');
            }}
          >
            Continue as admin
          </button>
        </div>
      </div>
    </main>
  );
}

function OidcLoginPage(): JSX.Element {
  const auth = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (auth.isLoading || auth.isAuthenticated || auth.error != null) {
      return;
    }
    void auth.signinRedirect();
  }, [auth]);

  if (auth.isAuthenticated) {
    return <Navigate to={redirectPathFromState(location.state)} replace />;
  }

  if (auth.error != null) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
        <p className="text-rose-300" role="alert">
          {signInErrorMessage(auth.error)}
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Check <span className="font-mono">VITE_OIDC_AUTHORITY</span> and{' '}
          <span className="font-mono">VITE_OIDC_CLIENT_ID</span>. Placeholder values such as
          your-tenant.auth0.com cannot complete sign-in.
        </p>
        <button
          type="button"
          className="mt-4 rounded bg-teal-600 px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => {
            void auth.signinRedirect();
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <p role="status">Redirecting to sign-in…</p>
    </main>
  );
}

export function LoginPage(): JSX.Element {
  if (!isOidcConfigured()) {
    return <LocalLoginPage />;
  }
  return <OidcLoginPage />;
}
