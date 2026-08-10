import type { DemoRole } from '@policy-pilot/shared-types';

import { actorIdForRole, DEMO_ROLE_STORAGE_KEY } from '../api/hitl-constants';

export interface DemoIdentity {
  role: DemoRole;
  actorId: string;
}

let currentIdentity: DemoIdentity = {
  role: 'user',
  actorId: actorIdForRole('user'),
};

export function parseStoredDemoRole(value: string | null): DemoRole {
  if (value === 'admin' || value === 'user') {
    return value;
  }
  return 'user';
}

export function readStoredDemoRole(): DemoRole {
  if (typeof window === 'undefined') {
    return 'user';
  }
  return parseStoredDemoRole(window.localStorage.getItem(DEMO_ROLE_STORAGE_KEY));
}

export function getDemoIdentity(): DemoIdentity {
  return currentIdentity;
}

export function setDemoIdentity(role: DemoRole): DemoIdentity {
  currentIdentity = {
    role,
    actorId: actorIdForRole(role),
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_ROLE_STORAGE_KEY, role);
  }
  return currentIdentity;
}

export function initializeDemoIdentity(): DemoIdentity {
  return setDemoIdentity(readStoredDemoRole());
}
