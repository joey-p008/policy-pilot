import type {
  AccessRequestDecisionPayload,
  AccessRequestDecisionResult,
  CreateAccessRequestPayload,
  PendingAccessRequest,
  RecommendationDecision,
} from '@policy-pilot/shared-types';

export const MOCK_PENDING_ACCESS_REQUESTS: PendingAccessRequest[] = [
  {
    requestId: 'req-rag-deny-001',
    employeeId: 'emp-hashed-042',
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

const MOCK_PENDING_STORE_KEY = '__policyPilotMockPendingAccessRequests__' as const;

type MockPendingGlobal = typeof globalThis & {
  [MOCK_PENDING_STORE_KEY]?: PendingAccessRequest[];
};

function clonePendingRequests(requests: PendingAccessRequest[]): PendingAccessRequest[] {
  return JSON.parse(JSON.stringify(requests)) as PendingAccessRequest[];
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

function buildMockRecommendation(
  payload: CreateAccessRequestPayload,
): PendingAccessRequest['recommendation'] {
  const lowered = `${payload.targetEntitlement} ${payload.justification}`.toLowerCase();
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

export function resetMockPendingAccessRequests(): void {
  setMockPendingStore(clonePendingRequests(MOCK_PENDING_ACCESS_REQUESTS));
}

export function getMockPendingAccessRequests(): PendingAccessRequest[] {
  return clonePendingRequests(getMockPendingStore());
}

export function createMockAccessRequest(payload: CreateAccessRequestPayload): PendingAccessRequest {
  console.info('[HITL mock create]', payload);

  const created: PendingAccessRequest = {
    requestId: `req-mock-${Date.now()}`,
    employeeId: 'E-MOCK-042',
    targetEntitlement: payload.targetEntitlement,
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
  console.info('[HITL mock decision]', payload, { status });

  const store = getMockPendingStore();
  const exists = store.some((request) => request.requestId === payload.requestId);
  if (!exists) {
    throw new Error(`Mock pending access request not found: ${payload.requestId}`);
  }

  setMockPendingStore(store.filter((request) => request.requestId !== payload.requestId));

  return {
    requestId: payload.requestId,
    status,
  };
}
