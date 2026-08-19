import type { LlmExecutionResult, LlmToolCall } from '../observability/llm-observability.types';

export const CHAT_CLIENT = Symbol('CHAT_CLIENT');

export interface ChatToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly strict: boolean;
  readonly requiresHumanApproval: boolean;
}

export type ChatToolChoice = 'auto' | 'required' | { readonly name: string };

export interface ChatCompletionOptions {
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
  readonly schemaName?: string;
  readonly tools?: ReadonlyArray<ChatToolDefinition>;
  readonly toolChoice?: ChatToolChoice;
}

export interface ChatClient {
  readonly model: string;
  complete(prompt: string, options?: ChatCompletionOptions): Promise<LlmExecutionResult>;
}

export type { LlmToolCall };
