import type { DemoRole } from '@policy-pilot/shared-types';

/** Seeded actor ids attached after JWT role mapping (mirrors backend seeds). */
export const DEMO_USER_ACTOR_ID = 'user-042';
export const DEMO_ADMIN_ACTOR_ID = 'admin-123';

export function actorIdForRole(role: DemoRole): string {
  return role === 'admin' ? DEMO_ADMIN_ACTOR_ID : DEMO_USER_ACTOR_ID;
}
