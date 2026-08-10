import type { DemoRole } from '@policy-pilot/shared-types';

import {
  SEED_ADMIN_EMPLOYEE_ID,
  SEED_DEMO_ADMIN_ACTOR_ID,
  SEED_DEMO_USER_ACTOR_ID,
  SEED_HITL_ADMIN_USER_ID,
  SEED_REQUESTOR_EMPLOYEE_ID,
  SEED_REQUESTOR_USER_ID,
} from '../access-requests/seed-ids';

export const DEMO_ROLE_HEADER = 'x-demo-role';
export const DEMO_ACTOR_ID_HEADER = 'x-demo-actor-id';

export const DEMO_ROLES_KEY = 'demo_roles';

export interface DemoPrincipal {
  role: DemoRole;
  actorId: string;
  userId: string;
  employeeId: string;
}

export const DEMO_PRINCIPALS: Readonly<Record<DemoRole, DemoPrincipal>> = {
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
