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

export const PROPOSED_ACCESS_DECISION_TOOL_NAME = 'propose_access_decision' as const;
export const PROPOSED_TOOL_AWAITING_HUMAN_APPROVAL = 'awaiting_human_approval' as const;

export interface ProposedAccessDecisionTool {
  name: typeof PROPOSED_ACCESS_DECISION_TOOL_NAME;
  status: typeof PROPOSED_TOOL_AWAITING_HUMAN_APPROVAL;
}

export const AWAITING_HUMAN_APPROVAL_PROPOSED_TOOL: ProposedAccessDecisionTool = {
  name: PROPOSED_ACCESS_DECISION_TOOL_NAME,
  status: PROPOSED_TOOL_AWAITING_HUMAN_APPROVAL,
};

export interface AccessRecommendation {
  decision: RecommendationDecision;
  rationale: string;
  policyCitations: PolicyCitation[];
  confidenceScore: number;
  proposedTool: ProposedAccessDecisionTool;
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
