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

export interface PendingAccessRequest extends BaseAccessRequest {
  currentEntitlements: string[];
  recommendation: AccessRecommendation;
}

export interface AccessRequestDecisionResult {
  requestId: string;
  status: 'approved' | 'denied';
}
