import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Pre-computed SHA-256 digests — no raw employee_id / cost_center values. */
const HASHES = {
  /* mock employee A */
  employeeA: 'd488904be1d025ba8a3bccb43ac80274d3022b6e071dbc4379390438d6691521',
  /* mock employee B */
  employeeB: '61689f36b1f324f30ce41adb27773659fb598de5a2af3284b648a4303d2faaaf',
  /* mock cost center 100 */
  costCenter100: 'd02c81895847a0671a5ad9621989da8ec6ef82174e0ab2b20936a8648b40ec55',
  /* mock cost center 200 */
  costCenter200: '4905fe7b8ad9cf74ee9f1dc5c66c6cd5cb0e66b3f53a099a277e9e681d1ec87c',
} as const;

const IDS = {
  userA: '8d0504b3-0e57-454a-833f-1c22aec8089b',
  userB: '041aa56a-3752-44ec-a157-436d4f30328f',
  entitlementA: 'a36e7537-953c-423e-9dd3-b6fa2edc6d4a',
  entitlementB: '5b871d1a-fc1c-4914-9c00-81a988cdfbdd',
  auditA: '82584cee-6bae-40dd-b620-e16c4613e06d',
  auditB: 'eebf80a0-e331-429f-9365-39ba90267a95',
} as const;

const IDEMPOTENCY_REQUEST_ID = 'seed-req-0001';

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: IDS.userA },
    create: {
      id: IDS.userA,
      employeeIdHash: HASHES.employeeA,
      department: 'Engineering',
      costCenterHash: HASHES.costCenter100,
      role: 'engineer',
    },
    update: {
      employeeIdHash: HASHES.employeeA,
      department: 'Engineering',
      costCenterHash: HASHES.costCenter100,
      role: 'engineer',
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.userB },
    create: {
      id: IDS.userB,
      employeeIdHash: HASHES.employeeB,
      department: 'Security',
      costCenterHash: HASHES.costCenter200,
      role: 'approver',
    },
    update: {
      employeeIdHash: HASHES.employeeB,
      department: 'Security',
      costCenterHash: HASHES.costCenter200,
      role: 'approver',
    },
  });

  await prisma.entitlement.upsert({
    where: { id: IDS.entitlementA },
    create: {
      id: IDS.entitlementA,
      resourceName: 'payroll-api',
      permissionLevel: 'read',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      user: { connect: { id: IDS.userA } },
    },
    update: {
      resourceName: 'payroll-api',
      permissionLevel: 'read',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      user: { connect: { id: IDS.userA } },
    },
  });

  await prisma.entitlement.upsert({
    where: { id: IDS.entitlementB },
    create: {
      id: IDS.entitlementB,
      resourceName: 'secrets-vault',
      permissionLevel: 'admin',
      expiresAt: null,
      user: { connect: { id: IDS.userB } },
    },
    update: {
      resourceName: 'secrets-vault',
      permissionLevel: 'admin',
      expiresAt: null,
      user: { connect: { id: IDS.userB } },
    },
  });

  await prisma.idempotencyKey.upsert({
    where: { requestId: IDEMPOTENCY_REQUEST_ID },
    create: {
      requestId: IDEMPOTENCY_REQUEST_ID,
      endpoint: '/webhooks/access-requests',
      responsePayload: {
        status: 'accepted',
        recommendation: 'ESCALATE',
      },
    },
    update: {
      endpoint: '/webhooks/access-requests',
      responsePayload: {
        status: 'accepted',
        recommendation: 'ESCALATE',
      },
    },
  });

  await prisma.accessAuditLog.upsert({
    where: { id: IDS.auditA },
    create: {
      id: IDS.auditA,
      requestId: IDEMPOTENCY_REQUEST_ID,
      action: 'RECOMMENDATION_CREATED',
      previousState: { status: 'PENDING' },
      newState: { status: 'ESCALATED', recommendation: 'ESCALATE' },
      actor: { connect: { id: IDS.userB } },
    },
    update: {
      requestId: IDEMPOTENCY_REQUEST_ID,
      action: 'RECOMMENDATION_CREATED',
      previousState: { status: 'PENDING' },
      newState: { status: 'ESCALATED', recommendation: 'ESCALATE' },
      actor: { connect: { id: IDS.userB } },
    },
  });

  await prisma.accessAuditLog.upsert({
    where: { id: IDS.auditB },
    create: {
      id: IDS.auditB,
      requestId: 'seed-req-0002',
      action: 'HUMAN_APPROVED',
      previousState: { status: 'ESCALATED' },
      newState: { status: 'APPROVED', actorRole: 'approver' },
      actor: { connect: { id: IDS.userB } },
    },
    update: {
      requestId: 'seed-req-0002',
      action: 'HUMAN_APPROVED',
      previousState: { status: 'ESCALATED' },
      newState: { status: 'APPROVED', actorRole: 'approver' },
      actor: { connect: { id: IDS.userB } },
    },
  });

  const counts = await prisma.$queryRaw<Array<{ table_name: string; row_count: bigint }>>`
    SELECT 'users' AS table_name, COUNT(*)::bigint AS row_count FROM users
    UNION ALL SELECT 'entitlements', COUNT(*)::bigint FROM entitlements
    UNION ALL SELECT 'idempotency_keys', COUNT(*)::bigint FROM idempotency_keys
    UNION ALL SELECT 'access_audit_logs', COUNT(*)::bigint FROM access_audit_logs
  `;

  console.log('Seed complete. Baseline row counts:');
  for (const row of counts) {
    console.log(`  ${row.table_name}: ${row.row_count.toString()}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
