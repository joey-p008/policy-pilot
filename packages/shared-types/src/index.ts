export interface BaseAccessRequest {
  requestId: string;
  employeeId: string;
  targetEntitlement: string;
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
  targetEntitlement: string;
  justification: string;
}

export interface PendingAccessRequest extends BaseAccessRequest {
  justification: string;
  currentEntitlements: string[];
  recommendation: AccessRecommendation;
}

export type AccessRequestHistoryStatus = 'APPROVED' | 'DENIED' | 'ESCALATED';

export interface AccessRequestHistoryItem extends BaseAccessRequest {
  justification: string;
  currentEntitlements: string[];
  recommendation: AccessRecommendation;
  status: AccessRequestHistoryStatus;
  decidedAt: string;
  decidedByAdminId: string | null;
}

export interface AccessRequestDecisionPayload {
  requestId: string;
}

export interface AccessRequestDecisionResult {
  requestId: string;
  status: 'approved' | 'denied' | 'escalated';
}

export type DemoRole = 'user' | 'admin';
