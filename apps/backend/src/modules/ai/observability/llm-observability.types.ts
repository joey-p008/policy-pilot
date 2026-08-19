import type { PromptKey } from '../../../config/prompts';

export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly argumentsJson: string;
}

export interface LlmExecutionResult {
  readonly content: string;
  readonly toolCalls?: ReadonlyArray<LlmToolCall>;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface LlmObservabilityRequest<TPayload> {
  readonly promptKey: PromptKey;
  readonly model: string;
  readonly payload: TPayload;
  readonly expectedToolName?: string;
  readonly execute: (assembledPrompt: string) => Promise<LlmExecutionResult>;
}

export interface LlmObservation {
  readonly promptName: PromptKey;
  readonly promptVersion: string;
  readonly model: string;
  readonly inputPrompt: string;
  readonly modelResponse: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly latencyMs: number;
  readonly estimatedCostUsd: number;
  readonly schemaValid: boolean;
  readonly schemaErrors: ReadonlyArray<string>;
  readonly toolName: string | null;
}

export interface LlmObservabilityResult<TData> {
  readonly data: TData | null;
  readonly observation: LlmObservation;
}
