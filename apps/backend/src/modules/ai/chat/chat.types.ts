import type { LlmExecutionResult } from '../observability/llm-observability.types';

export const CHAT_CLIENT = Symbol('CHAT_CLIENT');

export interface ChatClient {
  readonly model: string;
  complete(prompt: string): Promise<LlmExecutionResult>;
}
