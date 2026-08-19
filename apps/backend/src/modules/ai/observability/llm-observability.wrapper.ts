import { maskPII } from '@policy-pilot/shared';
import type { ZodType } from 'zod';

import { loadPrompt } from '../../../config/prompts';
import { extractExpectedToolCall } from '../tools/parse-proposed-tool-call';
import { estimateCostUsd } from './cost-estimator';
import {
  defaultLlmObservabilityLogger,
  type LlmObservabilityLogger,
} from './llm-observability.logger';
import type { LlmObservabilityRequest, LlmObservabilityResult } from './llm-observability.types';

function assemblePrompt(promptTemplate: string, payload: unknown): string {
  const serializedPayload = JSON.stringify(payload);
  return `${promptTemplate}\n\nRequest payload:\n${serializedPayload}`;
}

function parseModelJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

function maskJsonContent(content: string): string {
  try {
    return JSON.stringify(maskPII(JSON.parse(content) as unknown));
  } catch {
    return content;
  }
}

export async function executeWithObservability<TData, TPayload>(
  request: LlmObservabilityRequest<TPayload>,
  schema: ZodType<TData>,
  logger: LlmObservabilityLogger = defaultLlmObservabilityLogger,
): Promise<LlmObservabilityResult<TData>> {
  const { metadata, content: promptTemplate } = loadPrompt(request.promptKey);
  const assembledPrompt = assemblePrompt(promptTemplate, request.payload);
  const maskedAssembledPrompt = assemblePrompt(promptTemplate, maskPII(request.payload));

  const startedAt = Date.now();
  const execution = await request.execute(assembledPrompt);
  const latencyMs = Date.now() - startedAt;

  const expectedToolName = request.expectedToolName;
  let parsed: unknown = parseModelJson(execution.content);
  let modelResponseSource = execution.content;
  const schemaErrors: string[] = [];

  if (expectedToolName !== undefined) {
    const extracted = extractExpectedToolCall(execution.toolCalls, expectedToolName);
    if (!extracted.success) {
      schemaErrors.push(...extracted.errors);
      parsed = undefined;
    } else {
      parsed = extracted.data;
      modelResponseSource = extracted.argumentsJson;
    }
  }

  const validation = schemaErrors.length > 0 ? null : schema.safeParse(parsed);

  if (validation !== null && !validation.success) {
    schemaErrors.push(
      ...validation.error.issues.map(
        (issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`,
      ),
    );
  }

  const schemaValid = validation !== null && validation.success;

  const observation = {
    promptName: metadata.key,
    promptVersion: metadata.version,
    model: request.model,
    inputPrompt: maskedAssembledPrompt,
    modelResponse: maskJsonContent(modelResponseSource),
    inputTokens: execution.inputTokens,
    outputTokens: execution.outputTokens,
    latencyMs,
    estimatedCostUsd: estimateCostUsd(request.model, execution.inputTokens, execution.outputTokens),
    schemaValid,
    schemaErrors,
    toolName: expectedToolName ?? null,
  };

  logger.logObservation(observation);

  return {
    data: schemaValid && validation !== null ? validation.data : null,
    observation,
  };
}
