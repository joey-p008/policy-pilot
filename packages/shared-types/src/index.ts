export interface BaseAccessRequest {
  requestId: string;
  employeeId: string;
  title: string;
  department: string;
  costCenter: string;
  systemName: string;
  targetEntitlement: string;
  justification: string;
}

export interface PolicyCitation {
  documentId: string;
  pageNumber: number;
  sectionTitle: string;
  /** Optional RAG chunk body from policy_chunks.content when the HITL payload is enriched. */
  content?: string;
}

export type RecommendationDecision = 'APPROVE' | 'DENY' | 'ESCALATE';

export interface AccessRecommendation {
  decision: RecommendationDecision;
  rationale: string;
  policyCitations: PolicyCitation[];
  confidenceScore: number;
}

export interface CreateAccessRequestPayload {
  title: string;
  department: string;
  costCenter: string;
  systemName: string;
  entitlementKey: string;
  justification: string;
}

export interface PendingAccessRequest extends BaseAccessRequest {
  currentEntitlements: string[];
  recommendation: AccessRecommendation;
}

export type AccessRequestHistoryStatus = 'APPROVED' | 'DENIED' | 'ESCALATED';

/**
 * Downstream side of an approval. Entitlement execution runs asynchronously
 * behind a rate-limited queue, so a human decision of APPROVED can sit at
 * QUEUED until the 60 req/min downstream adapter has capacity.
 */
export type AccessRequestProvisioningStatus =
  'NOT_APPLICABLE' | 'QUEUED' | 'PROVISIONED' | 'FAILED';

export interface AccessRequestHistoryItem extends BaseAccessRequest {
  currentEntitlements: string[];
  recommendation: AccessRecommendation;
  status: AccessRequestHistoryStatus;
  provisioningStatus: AccessRequestProvisioningStatus;
  decidedAt: string;
  decidedByAdminId: string | null;
}

export interface AccessRequestDecisionPayload {
  requestId: string;
}

export interface AccessRequestDecisionResult {
  requestId: string;
  status: 'approved' | 'denied' | 'escalated';
  provisioningStatus: AccessRequestProvisioningStatus;
}

export type DemoRole = 'user' | 'admin';
