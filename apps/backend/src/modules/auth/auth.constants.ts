import type { DemoRole } from '@policy-pilot/shared-types';

import {
  SEED_ADMIN_EMPLOYEE_ID,
  SEED_DEMO_ADMIN_ACTOR_ID,
  SEED_DEMO_USER_ACTOR_ID,
  SEED_HITL_ADMIN_USER_ID,
  SEED_REQUESTOR_EMPLOYEE_ID,
  SEED_REQUESTOR_USER_ID,
} from '../access-requests/seed-ids';

export const ROLES_KEY = 'auth_roles';

/** Namespaced access-token claim used unless OIDC_ROLE_CLAIM is set. */
export const DEFAULT_OIDC_ROLE_CLAIM = 'https://policy-pilot.local/roles';

export interface AuthPrincipal {
  role: DemoRole;
  actorId: string;
  userId: string;
  employeeId: string;
}

/**
 * Seeded HITL identities. JWT `sub` is not provisioned into `users` in this
 * slice; role claims map onto these principals so entitlement and audit FKs
 * keep using stable seed UUIDs.
 */
export const AUTH_PRINCIPALS: Readonly<Record<DemoRole, AuthPrincipal>> = {
  user: {
    role: 'user',
    actorId: SEED_DEMO_USER_ACTOR_ID,
    userId: SEED_REQUESTOR_USER_ID,
    employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
  },
  admin: {
    role: 'admin',
    actorId: SEED_DEMO_ADMIN_ACTOR_ID,
    userId: SEED_HITL_ADMIN_USER_ID,
    employeeId: SEED_ADMIN_EMPLOYEE_ID,
  },
};
