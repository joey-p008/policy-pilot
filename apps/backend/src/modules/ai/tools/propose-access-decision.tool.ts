import { PROPOSED_ACCESS_DECISION_TOOL_NAME } from '@policy-pilot/shared-types';

import type { ChatToolDefinition } from '../chat/chat.types';
import { DecisionJsonSchema } from '../schemas/recommendation.schema';

export const PROPOSE_ACCESS_DECISION_TOOL_NAME = PROPOSED_ACCESS_DECISION_TOOL_NAME;

export const PROPOSE_ACCESS_DECISION_TOOL_DESCRIPTION =
  'Propose an APPROVE, DENY, or ESCALATE recommendation for a Human-in-the-Loop reviewer. This tool does not grant, revoke, or mutate entitlements. A human must confirm the proposal in the dashboard before any access change is executed.';

export const PROPOSE_ACCESS_DECISION_TOOL: ChatToolDefinition = {
  name: PROPOSE_ACCESS_DECISION_TOOL_NAME,
  description: PROPOSE_ACCESS_DECISION_TOOL_DESCRIPTION,
  parameters: DecisionJsonSchema,
  strict: true,
  requiresHumanApproval: true,
};

export function isGatedAccessDecisionTool(tool: ChatToolDefinition): boolean {
  return tool.name === PROPOSE_ACCESS_DECISION_TOOL_NAME && tool.requiresHumanApproval;
}
