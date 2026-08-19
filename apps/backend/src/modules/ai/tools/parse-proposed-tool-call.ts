import type { LlmToolCall } from '../observability/llm-observability.types';
import { DecisionSchema, type Decision } from '../schemas/recommendation.schema';
import { PROPOSE_ACCESS_DECISION_TOOL_NAME } from './propose-access-decision.tool';

export interface ToolCallParseSuccess<TData> {
  readonly success: true;
  readonly data: TData;
  readonly argumentsJson: string;
  readonly toolCallId: string;
}

export interface ToolCallParseFailure {
  readonly success: false;
  readonly errors: ReadonlyArray<string>;
  readonly argumentsJson: string;
}

export type ToolCallParseResult<TData> = ToolCallParseSuccess<TData> | ToolCallParseFailure;

const DecisionToolArgsSchema = DecisionSchema.strict();

function formatIssuePath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return 'root';
  }
  return path.map(String).join('.');
}

export function extractExpectedToolCall(
  toolCalls: ReadonlyArray<LlmToolCall> | undefined,
  expectedToolName: string,
): ToolCallParseResult<unknown> {
  const calls = toolCalls ?? [];

  if (calls.length !== 1) {
    return {
      success: false,
      argumentsJson: '',
      errors: [
        `root: expected exactly one tool call named ${expectedToolName}, received ${String(calls.length)}`,
      ],
    };
  }

  const toolCall = calls[0];
  if (toolCall === undefined) {
    return {
      success: false,
      argumentsJson: '',
      errors: [`root: expected exactly one tool call named ${expectedToolName}, received 0`],
    };
  }

  if (toolCall.name !== expectedToolName) {
    return {
      success: false,
      argumentsJson: toolCall.argumentsJson,
      errors: [`toolCalls.0.name: expected ${expectedToolName}, received ${toolCall.name}`],
    };
  }

  try {
    const parsed: unknown = JSON.parse(toolCall.argumentsJson);
    return {
      success: true,
      data: parsed,
      argumentsJson: toolCall.argumentsJson,
      toolCallId: toolCall.id,
    };
  } catch {
    return {
      success: false,
      argumentsJson: toolCall.argumentsJson,
      errors: ['arguments: invalid JSON'],
    };
  }
}

export function parseProposedAccessDecisionToolCall(
  toolCalls: ReadonlyArray<LlmToolCall> | undefined,
): ToolCallParseResult<Decision> {
  const extracted = extractExpectedToolCall(toolCalls, PROPOSE_ACCESS_DECISION_TOOL_NAME);
  if (!extracted.success) {
    return extracted;
  }

  const validation = DecisionToolArgsSchema.safeParse(extracted.data);
  if (!validation.success) {
    return {
      success: false,
      argumentsJson: extracted.argumentsJson,
      errors: validation.error.issues.map(
        (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
      ),
    };
  }

  return {
    success: true,
    data: validation.data,
    argumentsJson: extracted.argumentsJson,
    toolCallId: extracted.toolCallId,
  };
}
