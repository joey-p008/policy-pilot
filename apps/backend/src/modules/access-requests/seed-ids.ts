/** Stable seed UUIDs and HITL identity constants shared by seed + services. */

export const SEED_USER_A_ID = '8d0504b3-0e57-454a-833f-1c22aec8089b';
export const SEED_USER_B_ID = '041aa56a-3752-44ec-a157-436d4f30328f';

/** Stable HITL admin actor mapped from demo actor id "admin-123". */
export const SEED_HITL_ADMIN_USER_ID = 'f1c2a3b4-5d6e-4789-a012-3456789abcde';
export const SEED_HITL_ADMIN_API_ID = 'admin-123';

/** Demo RBAC actor ids sent via X-Demo-Actor-Id. */
export const SEED_DEMO_USER_ACTOR_ID = 'user-042';
export const SEED_DEMO_ADMIN_ACTOR_ID = SEED_HITL_ADMIN_API_ID;

export const SEED_REQUESTOR_USER_ID = SEED_USER_A_ID;
export const SEED_REQUESTOR_EMPLOYEE_ID = 'E-MOCK-042';
export const SEED_ADMIN_EMPLOYEE_ID = 'E-MOCK-ADMIN';

export const SEED_ENTITLEMENT_A_ID = 'a36e7537-953c-423e-9dd3-b6fa2edc6d4a';
export const SEED_ENTITLEMENT_B_ID = '5b871d1a-fc1c-4914-9c00-81a988cdfbdd';
export const SEED_AUDIT_A_ID = '82584cee-6bae-40dd-b620-e16c4613e06d';
export const SEED_AUDIT_B_ID = 'eebf80a0-e331-429f-9365-39ba90267a95';

/** System actor used when webhook ingest cannot resolve a user for audit FK. */
export const SEED_SYSTEM_INGEST_USER_ID = '9e8d7c6b-5a49-4f3e-8d2c-1b0a9f8e7d6c';
