import type { DemoRole } from '@policy-pilot/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type JSX, type ReactNode } from 'react';

import {
  ACCESS_REQUESTS_HISTORY_QUERY_KEY,
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
} from '../api/access-request-keys';
import {
  getDemoIdentity,
  initializeDemoIdentity,
  setDemoIdentity,
  type DemoIdentity,
} from '../lib/demo-identity';

interface DemoRoleContextValue {
  identity: DemoIdentity;
  role: DemoRole;
  setRole: (role: DemoRole) => void;
  isAdmin: boolean;
}

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null);

export function DemoRoleProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [identity, setIdentity] = useState<DemoIdentity>(() => initializeDemoIdentity());

  useEffect(() => {
    setIdentity(getDemoIdentity());
  }, []);

  const setRole = (role: DemoRole): void => {
    setIdentity(setDemoIdentity(role));
    void queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_HISTORY_QUERY_KEY });
  };

  return (
    <DemoRoleContext.Provider
      value={{
        identity,
        role: identity.role,
        setRole,
        isAdmin: identity.role === 'admin',
      }}
    >
      {children}
    </DemoRoleContext.Provider>
  );
}

export function useDemoRole(): DemoRoleContextValue {
  const value = useContext(DemoRoleContext);
  if (value === null) {
    throw new Error('useDemoRole must be used within DemoRoleProvider');
  }
  return value;
}
