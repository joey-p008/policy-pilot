import type { DemoRole } from '@policy-pilot/shared-types';
import { createContext, useContext, type JSX, type ReactNode } from 'react';

import {
  getAuthSession,
  setAuthSession,
  setAuthSessionForTests,
  type AuthSessionSnapshot,
} from '../lib/auth-session';

export interface AuthSessionContextValue {
  session: AuthSessionSnapshot | null;
  role: DemoRole | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function MockAuthSessionProvider({ children }: { children: ReactNode }): JSX.Element {
  const snapshot = getAuthSession() ?? setAuthSessionForTests('user');

  const value: AuthSessionContextValue = {
    session: snapshot,
    role: snapshot.role,
    isAdmin: snapshot.role === 'admin',
    isAuthenticated: true,
    isLoading: false,
    signOut: async (): Promise<void> => {
      setAuthSession(null);
    },
  };

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);
  if (value === null) {
    throw new Error('useAuthSession must be used within AuthSessionBridge');
  }
  return value;
}
