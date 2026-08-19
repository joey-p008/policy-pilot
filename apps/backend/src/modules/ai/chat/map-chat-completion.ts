import type { ChatToolChoice, ChatToolDefinition } from './chat.types';
import type { LlmExecutionResult, LlmToolCall } from '../observability/llm-observability.types';

export interface OpenAiFunctionToolCall {
  readonly id: string;
  readonly type?: string;
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

export interface ChatCompletionMessageLike {
  readonly content?: string | null;
  readonly tool_calls?: ReadonlyArray<OpenAiFunctionToolCall> | null;
}

export interface OpenAiFunctionTool {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly strict: boolean;
  };
}

export type OpenAiToolChoice =
  | 'auto'
  | 'required'
  | {
      readonly type: 'function';
      readonly function: { readonly name: string };
    };

export function toOpenAiTools(tools: ReadonlyArray<ChatToolDefinition>): OpenAiFunctionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: { ...tool.parameters },
      strict: tool.strict,
    },
  }));
}

export function toOpenAiToolChoice(toolChoice: ChatToolChoice): OpenAiToolChoice {
  if (toolChoice === 'auto' || toolChoice === 'required') {
    return toolChoice;
  }

  return {
    type: 'function',
    function: { name: toolChoice.name },
  };
}

export function mapToolCalls(
  toolCalls: ReadonlyArray<OpenAiFunctionToolCall> | null | undefined,
): ReadonlyArray<LlmToolCall> {
  if (toolCalls === null || toolCalls === undefined) {
    return [];
  }

  return toolCalls
    .filter((toolCall) => toolCall.type === undefined || toolCall.type === 'function')
    .map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      argumentsJson: toolCall.function.arguments,
    }));
}

export function toLlmExecutionResult(input: {
  readonly message: ChatCompletionMessageLike;
  readonly inputTokens: number;
  readonly outputTokens: number;
}): LlmExecutionResult {
  const toolCalls = mapToolCalls(input.message.tool_calls);
  const rawContent = input.message.content;
  const contentFromMessage = rawContent === null || rawContent === undefined ? '' : rawContent;
  const firstToolArguments = toolCalls[0]?.argumentsJson;
  const content = contentFromMessage.length > 0 ? contentFromMessage : (firstToolArguments ?? '');

  if (content.length === 0 && toolCalls.length === 0) {
    throw new Error('OpenAI chat completion returned empty content');
  }

  return {
    content,
    toolCalls,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
  };
}
