import type { DemoRole } from '@policy-pilot/shared-types';

import { actorIdForRole } from '../api/hitl-constants';

export interface AuthSessionSnapshot {
  role: DemoRole;
  actorId: string;
  subject: string;
  accessToken: string;
}

let currentSession: AuthSessionSnapshot | null = null;

export function getAuthSession(): AuthSessionSnapshot | null {
  return currentSession;
}

export function setAuthSession(session: AuthSessionSnapshot | null): void {
  currentSession = session;
}

export function setAuthSessionForTests(role: DemoRole): AuthSessionSnapshot {
  const session: AuthSessionSnapshot = {
    role,
    actorId: actorIdForRole(role),
    subject: `test-${role}`,
    accessToken: 'test-access-token',
  };
  setAuthSession(session);
  return session;
}
