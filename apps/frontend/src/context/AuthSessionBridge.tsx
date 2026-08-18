import { useEffect, useLayoutEffect, useMemo, type JSX, type ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';

import { actorIdForRole } from '../api/hitl-constants';
import { setUnauthorizedHandler } from '../lib/apiClient';
import { setAuthSession, type AuthSessionSnapshot } from '../lib/auth-session';
import { roleFromAccessToken } from '../lib/jwt-payload';
import { readOidcRoleClaim } from '../lib/oidc-config';
import { AuthSessionContext, type AuthSessionContextValue } from './AuthSessionContext';

export function AuthSessionBridge({ children }: { children: ReactNode }): JSX.Element {
  const auth = useAuth();

  const value = useMemo((): AuthSessionContextValue => {
    const accessToken = auth.user?.access_token;
    const role =
      typeof accessToken === 'string'
        ? roleFromAccessToken(accessToken, readOidcRoleClaim())
        : undefined;
    const subject = auth.user?.profile.sub;

    const session: AuthSessionSnapshot | null =
      auth.isAuthenticated &&
      typeof accessToken === 'string' &&
      accessToken.length > 0 &&
      role !== undefined
        ? {
            role,
            actorId: actorIdForRole(role),
            subject: typeof subject === 'string' ? subject : '',
            accessToken,
          }
        : null;

    return {
      session,
      role: role ?? null,
      isAdmin: role === 'admin',
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
      signInWithRole: null,
      signOut: async (): Promise<void> => {
        setAuthSession(null);
        await auth.signoutRedirect();
      },
    };
  }, [auth]);

  useLayoutEffect(() => {
    setAuthSession(value.session);
  }, [value.session]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      try {
        const user = await auth.signinSilent();
        const token = user?.access_token;
        if (typeof token === 'string' && token.length > 0) {
          return token;
        }
      } catch {
        // Interactive sign-in is the fallback when silent renew is unavailable.
      }
      await auth.signinRedirect();
      return null;
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [auth]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
