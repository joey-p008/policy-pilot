import type { LlmExecutionResult } from '../observability/llm-observability.types';

export const CHAT_CLIENT = Symbol('CHAT_CLIENT');

export interface ChatCompletionOptions {
  readonly jsonSchema?: Readonly<Record<string, unknown>>;
  readonly schemaName?: string;
}

export interface ChatClient {
  readonly model: string;
  complete(prompt: string, options?: ChatCompletionOptions): Promise<LlmExecutionResult>;
}
