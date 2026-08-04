import { maskPII } from '@policy-pilot/shared';

import type { LlmObservation } from './llm-observability.types';

export interface LlmObservabilityLogger {
  logObservation(observation: LlmObservation): void;
}

export class ConsoleLlmObservabilityLogger implements LlmObservabilityLogger {
  logObservation(observation: LlmObservation): void {
    const masked = maskPII({
      promptName: observation.promptName,
      promptVersion: observation.promptVersion,
      model: observation.model,
      inputPrompt: observation.inputPrompt,
      modelResponse: observation.modelResponse,
      inputTokens: observation.inputTokens,
      outputTokens: observation.outputTokens,
      latencyMs: observation.latencyMs,
      estimatedCostUsd: observation.estimatedCostUsd,
      schemaValid: observation.schemaValid,
      schemaErrors: observation.schemaErrors,
    });

    console.info(
      JSON.stringify({
        event: 'llm.observation',
        ...masked,
      }),
    );
  }
}

export const defaultLlmObservabilityLogger = new ConsoleLlmObservabilityLogger();
