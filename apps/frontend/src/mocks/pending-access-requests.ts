import type {
  AccessRequestDecisionPayload,
  AccessRequestDecisionResult,
  AccessRequestHistoryItem,
  AccessRequestProvisioningStatus,
  CreateAccessRequestPayload,
  PendingAccessRequest,
  RecommendationDecision,
} from '@policy-pilot/shared-types';

import { getAuthSession } from '../lib/auth-session';

export const MOCK_PENDING_ACCESS_REQUESTS: PendingAccessRequest[] = [
  {
    requestId: 'req-rag-deny-001',
    employeeId: 'emp-hashed-042',
    title: 'Site Reliability Engineer',
    department: 'Platform Engineering',
    costCenter: 'CC-ENG-12',
    systemName: 'DATA_WAREHOUSE',
    targetEntitlement: 'prod-postgres-admin',
    justification: 'Need production admin to restart a failed migration job.',
    currentEntitlements: ['prod-postgres-read', 'staging-postgres-write'],
    recommendation: {
      decision: 'DENY',
      rationale:
        'Production database administrator access requires an approved change ticket under the Cloud Infrastructure Privileged Access policy. The request does not reference a change ticket, so the recommendation is DENY until that evidence is provided.',
      confidenceScore: 0.91,
      policyCitations: [
        {
          documentId: 'POL-2026-02',
          pageNumber: 4,
          sectionTitle: 'Privileged Access',
          content:
            'Production admin entitlements for cloud data stores require an approved change ticket before grant. Self-service requests without a linked ticket must be denied or escalated to the on-call security reviewer.',
        },
        {
          documentId: 'POL-2026-02',
          pageNumber: 6,
          sectionTitle: 'Break-Glass Exceptions',
          content:
            'Break-glass admin access is limited to declared incidents and must be time-bound to no more than four hours with dual approval from Security and the owning service manager.',
        },
      ],
    },
  },
  {
    requestId: 'req-rag-escalate-002',
    employeeId: 'emp-hashed-117',
    title: 'Data Analyst',
    department: 'Finance Analytics',
    costCenter: 'CC-FIN-07',
    systemName: 'DATA_WAREHOUSE',
    targetEntitlement: 'analytics-warehouse-writer',
    justification: 'Quarterly reporting needs write access to the analytics warehouse.',
    currentEntitlements: ['analytics-warehouse-reader'],
    recommendation: {
      decision: 'ESCALATE',
      rationale:
        'Warehouse write access may be appropriate for the analytics role, but the retrieved policy sections conflict on whether departmental manager approval is sufficient versus requiring Data Governance review. Escalate for human adjudication.',
      confidenceScore: 0.38,
      policyCitations: [
        {
          documentId: 'POL-2026-01',
          pageNumber: 3,
          sectionTitle: 'Data Access Tiers',
          content:
            'Write access to the analytics warehouse is granted to analysts whose manager has attested to a legitimate business need. Read-only access is the default for new joiners.',
        },
        {
          documentId: 'POL-2026-01',
          pageNumber: 9,
          sectionTitle: 'Governance Review Triggers',
          content:
            'Any upgrade from reader to writer on regulated warehouse datasets must be reviewed by Data Governance when the dataset is tagged as containing customer PII or financial aggregates.',
        },
      ],
    },
  },
];

export const MOCK_HISTORY_ACCESS_REQUESTS: AccessRequestHistoryItem[] = [
  {
    requestId: 'req-hist-approved-001',
    employeeId: 'E-MOCK-042',
    title: 'Data Analyst',
    department: 'Finance Analytics',
    costCenter: 'CC-FIN-07',
    systemName: 'DATA_WAREHOUSE',
    targetEntitlement: 'analytics-dashboard-reader',
    justification: 'Need read access for Q2 dashboard reviews.',
    currentEntitlements: ['prod-postgres-read'],
    recommendation: {
      decision: 'APPROVE',
      rationale: 'Read-scoped dashboard access is within policy for the requestor role.',
      confidenceScore: 0.86,
      policyCitations: [
        {
          documentId: 'POL-2026-01',
          pageNumber: 3,
          sectionTitle: 'Data Access Tiers',
          content: 'Read-only access is the default for new joiners.',
        },
      ],
    },
    status: 'APPROVED',
    provisioningStatus: 'PROVISIONED',
    decidedAt: '2026-07-15T14:30:00.000Z',
    decidedByAdminId: 'admin-123',
  },
];

const MOCK_PENDING_STORE_KEY = '__policyPilotMockPendingAccessRequests__' as const;
const MOCK_HISTORY_STORE_KEY = '__policyPilotMockHistoryAccessRequests__' as const;

type MockPendingGlobal = typeof globalThis & {
  [MOCK_PENDING_STORE_KEY]?: PendingAccessRequest[];
  [MOCK_HISTORY_STORE_KEY]?: AccessRequestHistoryItem[];
};

function clonePendingRequests(requests: PendingAccessRequest[]): PendingAccessRequest[] {
  return JSON.parse(JSON.stringify(requests)) as PendingAccessRequest[];
}

function cloneHistoryRequests(requests: AccessRequestHistoryItem[]): AccessRequestHistoryItem[] {
  return JSON.parse(JSON.stringify(requests)) as AccessRequestHistoryItem[];
}

function getMockPendingStore(): PendingAccessRequest[] {
  const globalRef = globalThis as MockPendingGlobal;
  const existing = globalRef[MOCK_PENDING_STORE_KEY];
  if (existing === undefined) {
    const seeded = clonePendingRequests(MOCK_PENDING_ACCESS_REQUESTS);
    globalRef[MOCK_PENDING_STORE_KEY] = seeded;
    return seeded;
  }
  return existing;
}

function setMockPendingStore(requests: PendingAccessRequest[]): void {
  (globalThis as MockPendingGlobal)[MOCK_PENDING_STORE_KEY] = requests;
}

function getMockHistoryStore(): AccessRequestHistoryItem[] {
  const globalRef = globalThis as MockPendingGlobal;
  const existing = globalRef[MOCK_HISTORY_STORE_KEY];
  if (existing === undefined) {
    const seeded = cloneHistoryRequests(MOCK_HISTORY_ACCESS_REQUESTS);
    globalRef[MOCK_HISTORY_STORE_KEY] = seeded;
    return seeded;
  }
  return existing;
}

function setMockHistoryStore(requests: AccessRequestHistoryItem[]): void {
  (globalThis as MockPendingGlobal)[MOCK_HISTORY_STORE_KEY] = requests;
}

function requireAuthSession(): NonNullable<ReturnType<typeof getAuthSession>> {
  const session = getAuthSession();
  if (session === null) {
    throw new Error('Mock RBAC denied: signed-in session required');
  }
  return session;
}

function assertAdminRole(): void {
  const session = requireAuthSession();
  if (session.role !== 'admin') {
    throw new Error('Mock RBAC denied: admin role required for this action');
  }
}

function buildMockRecommendation(
  payload: CreateAccessRequestPayload,
): PendingAccessRequest['recommendation'] {
  const lowered = `${payload.entitlementKey} ${payload.justification}`.toLowerCase();
  let decision: RecommendationDecision = 'ESCALATE';
  let confidenceScore = 0.42;
  let rationale =
    'Policy context is ambiguous for this entitlement and justification pairing. Escalate for human adjudication.';

  if (lowered.includes('admin') || lowered.includes('prod-postgres')) {
    decision = 'DENY';
    confidenceScore = 0.88;
    rationale =
      'Privileged production access typically requires an approved change ticket. The submitted justification does not cite one, so the mock agent recommends DENY.';
  } else if (lowered.includes('read') || lowered.includes('viewer')) {
    decision = 'APPROVE';
    confidenceScore = 0.81;
    rationale =
      'Read-scoped entitlements with a clear business justification are generally within policy for the mock agent.';
  }

  return {
    decision,
    confidenceScore,
    rationale,
    policyCitations: [
      {
        documentId: 'POL-2026-02',
        pageNumber: 4,
        sectionTitle: 'Privileged Access',
        content:
          'Production admin entitlements for cloud data stores require an approved change ticket before grant.',
      },
    ],
  };
}

function toHistoryStatus(
  status: AccessRequestDecisionResult['status'],
): AccessRequestHistoryItem['status'] {
  if (status === 'approved') {
    return 'APPROVED';
  }
  if (status === 'denied') {
    return 'DENIED';
  }
  return 'ESCALATED';
}

/**
 * Mirrors the backend: an approval only queues the downstream grant, so the
 * mock reports QUEUED rather than pretending the entitlement already landed.
 */
function toProvisioningStatus(
  status: AccessRequestDecisionResult['status'],
): AccessRequestProvisioningStatus {
  return status === 'approved' ? 'QUEUED' : 'NOT_APPLICABLE';
}

export function resetMockPendingAccessRequests(): void {
  setMockPendingStore(clonePendingRequests(MOCK_PENDING_ACCESS_REQUESTS));
  setMockHistoryStore(cloneHistoryRequests(MOCK_HISTORY_ACCESS_REQUESTS));
}

export function getMockPendingAccessRequests(): PendingAccessRequest[] {
  assertAdminRole();
  return clonePendingRequests(getMockPendingStore());
}

export function getMockHistoryAccessRequests(): AccessRequestHistoryItem[] {
  assertAdminRole();
  return cloneHistoryRequests(getMockHistoryStore());
}

export function createMockAccessRequest(payload: CreateAccessRequestPayload): PendingAccessRequest {
  console.info('[HITL mock create]', payload);

  const session = requireAuthSession();
  const created: PendingAccessRequest = {
    requestId: `req-mock-${Date.now()}`,
    employeeId: session.role === 'admin' ? 'E-MOCK-ADMIN' : 'E-MOCK-042',
    title: payload.title,
    department: payload.department,
    costCenter: payload.costCenter,
    systemName: payload.systemName,
    targetEntitlement: payload.entitlementKey,
    justification: payload.justification,
    currentEntitlements: ['prod-postgres-read'],
    recommendation: buildMockRecommendation(payload),
  };

  setMockPendingStore([created, ...getMockPendingStore()]);
  return clonePendingRequests([created])[0] as PendingAccessRequest;
}

export function applyMockDecision(
  payload: AccessRequestDecisionPayload,
  status: AccessRequestDecisionResult['status'],
): AccessRequestDecisionResult {
  assertAdminRole();
  console.info('[HITL mock decision]', payload, { status });

  const identity = requireAuthSession();
  const pendingStore = getMockPendingStore();
  const pendingMatch = pendingStore.find((request) => request.requestId === payload.requestId);

  if (pendingMatch !== undefined) {
    setMockPendingStore(pendingStore.filter((request) => request.requestId !== payload.requestId));
    const historyItem: AccessRequestHistoryItem = {
      ...pendingMatch,
      status: toHistoryStatus(status),
      provisioningStatus: toProvisioningStatus(status),
      decidedAt: new Date().toISOString(),
      decidedByAdminId: identity.actorId,
    };
    setMockHistoryStore([historyItem, ...getMockHistoryStore()]);
    return {
      requestId: payload.requestId,
      status,
      provisioningStatus: historyItem.provisioningStatus,
    };
  }

  const historyStore = getMockHistoryStore();
  const historyMatch = historyStore.find((request) => request.requestId === payload.requestId);
  if (historyMatch === undefined) {
    throw new Error(`Mock access request not found: ${payload.requestId}`);
  }

  const nextStatus = toHistoryStatus(status);
  if (historyMatch.status === nextStatus) {
    throw new Error(`Mock access request already has status ${nextStatus}`);
  }

  const nextProvisioningStatus = toProvisioningStatus(status);

  setMockHistoryStore(
    historyStore.map((request) =>
      request.requestId === payload.requestId
        ? {
            ...request,
            status: nextStatus,
            provisioningStatus: nextProvisioningStatus,
            decidedAt: new Date().toISOString(),
            decidedByAdminId: identity.actorId,
          }
        : request,
    ),
  );

  return {
    requestId: payload.requestId,
    status,
    provisioningStatus: nextProvisioningStatus,
  };
}
