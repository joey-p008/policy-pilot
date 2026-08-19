import type { LlmToolCall } from '../observability/llm-observability.types';
import { parseProposedAccessDecisionToolCall } from './parse-proposed-tool-call';
import {
  isGatedAccessDecisionTool,
  PROPOSE_ACCESS_DECISION_TOOL,
  PROPOSE_ACCESS_DECISION_TOOL_NAME,
} from './propose-access-decision.tool';

const validDecision = {
  decision: 'DENY' as const,
  rationale: 'Policy forbids production admin without a change ticket.',
  policy_citations: [
    {
      document_id: 'POL-2026-02',
      page_number: 4,
      section_title: 'Privileged Access',
    },
  ],
  confidence_score: 0.91,
};

function toolCall(overrides: Partial<LlmToolCall> = {}): LlmToolCall {
  return {
    id: 'call_1',
    name: PROPOSE_ACCESS_DECISION_TOOL_NAME,
    argumentsJson: JSON.stringify(validDecision),
    ...overrides,
  };
}

describe('propose_access_decision tool', () => {
  it('is marked as requiring human approval and never describes execution', () => {
    expect(isGatedAccessDecisionTool(PROPOSE_ACCESS_DECISION_TOOL)).toBe(true);
    expect(PROPOSE_ACCESS_DECISION_TOOL.requiresHumanApproval).toBe(true);
    expect(PROPOSE_ACCESS_DECISION_TOOL.description.toLowerCase()).toContain('human');
    expect(PROPOSE_ACCESS_DECISION_TOOL.description.toLowerCase()).not.toContain(
      'grant entitlement',
    );
  });

  it('parses a single valid propose_access_decision tool call', () => {
    const result = parseProposedAccessDecisionToolCall([toolCall()]);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('expected successful parse');
    }
    expect(result.data).toEqual(validDecision);
    expect(result.toolCallId).toBe('call_1');
  });

  it('rejects a missing tool call', () => {
    const result = parseProposedAccessDecisionToolCall([]);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failed parse');
    }
    expect(result.errors[0]).toMatch(/exactly one tool call/);
  });

  it('rejects a wrong tool name', () => {
    const result = parseProposedAccessDecisionToolCall([toolCall({ name: 'grant_entitlement' })]);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failed parse');
    }
    expect(result.errors[0]).toMatch(/grant_entitlement/);
  });

  it('rejects two tool calls', () => {
    const result = parseProposedAccessDecisionToolCall([toolCall(), toolCall({ id: 'call_2' })]);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failed parse');
    }
    expect(result.errors[0]).toMatch(/received 2/);
  });

  it('rejects invalid JSON arguments', () => {
    const result = parseProposedAccessDecisionToolCall([toolCall({ argumentsJson: '{not-json' })]);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failed parse');
    }
    expect(result.errors).toEqual(['arguments: invalid JSON']);
  });

  it('rejects extra keys in the tool payload', () => {
    const result = parseProposedAccessDecisionToolCall([
      toolCall({
        argumentsJson: JSON.stringify({
          ...validDecision,
          execute_grant: true,
        }),
      }),
    ]);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected failed parse');
    }
    expect(result.errors.some((error) => error.includes('execute_grant'))).toBe(true);
  });
});
