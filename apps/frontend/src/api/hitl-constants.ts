import type { DemoRole } from '@policy-pilot/shared-types';

/** Demo actor ids mirrored from backend seed principals. */
export const DEMO_USER_ACTOR_ID = 'user-042';
export const DEMO_ADMIN_ACTOR_ID = 'admin-123';

export const DEMO_ROLE_HEADER = 'X-Demo-Role';
export const DEMO_ACTOR_ID_HEADER = 'X-Demo-Actor-Id';

export const DEMO_ROLE_STORAGE_KEY = 'policy-pilot.demo-role';

export function actorIdForRole(role: DemoRole): string {
  return role === 'admin' ? DEMO_ADMIN_ACTOR_ID : DEMO_USER_ACTOR_ID;
}
