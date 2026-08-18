import type { DemoRole } from '@policy-pilot/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from 'react';

import { actorIdForRole } from '../api/hitl-constants';
import {
  getAuthSession,
  setAuthSession,
  setAuthSessionForTests,
  type AuthSessionSnapshot,
} from '../lib/auth-session';

const LOCAL_AUTH_ROLE_STORAGE_KEY = 'policy-pilot.local-auth-role';

export interface AuthSessionContextValue {
  session: AuthSessionSnapshot | null;
  role: DemoRole | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithRole: ((role: DemoRole) => void) | null;
  signOut: () => Promise<void>;
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

function readStoredLocalRole(): DemoRole | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const stored = window.sessionStorage.getItem(LOCAL_AUTH_ROLE_STORAGE_KEY);
  if (stored === 'admin' || stored === 'user') {
    return stored;
  }
  return null;
}

function writeStoredLocalRole(role: DemoRole | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (role === null) {
    window.sessionStorage.removeItem(LOCAL_AUTH_ROLE_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(LOCAL_AUTH_ROLE_STORAGE_KEY, role);
}

function sessionForRole(role: DemoRole): AuthSessionSnapshot {
  return {
    role,
    actorId: actorIdForRole(role),
    subject: `local-${role}`,
    accessToken: '',
  };
}

export function MockAuthSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const snapshot = getAuthSession() ?? setAuthSessionForTests('user');

  const value: AuthSessionContextValue = {
    session: snapshot,
    role: snapshot.role,
    isAdmin: snapshot.role === 'admin',
    isAuthenticated: true,
    isLoading: false,
    signInWithRole: setAuthSessionForTests,
    signOut: async (): Promise<void> => {
      setAuthSession(null);
    },
  };

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function LocalAuthSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const [role, setRole] = useState<DemoRole | null>(() => readStoredLocalRole());

  const signInWithRole = useCallback((nextRole: DemoRole): void => {
    writeStoredLocalRole(nextRole);
    setRole(nextRole);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    writeStoredLocalRole(null);
    setAuthSession(null);
    setRole(null);
  }, []);

  const value = useMemo((): AuthSessionContextValue => {
    if (role === null) {
      return {
        session: null,
        role: null,
        isAdmin: false,
        isAuthenticated: false,
        isLoading: false,
        signInWithRole,
        signOut,
      };
    }

    const session = sessionForRole(role);
    return {
      session,
      role,
      isAdmin: role === 'admin',
      isAuthenticated: true,
      isLoading: false,
      signInWithRole,
      signOut,
    };
  }, [role, signInWithRole, signOut]);

  useLayoutEffect(() => {
    setAuthSession(value.session);
  }, [value.session]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error('useAuthSession must be used within AuthSessionBridge');
  }
  return value;
}
