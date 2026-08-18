import { useEffect, type JSX } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

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

export function LoginPage(): JSX.Element {
  const auth = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (auth.isLoading || auth.isAuthenticated) {
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
          Sign-in failed.
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
