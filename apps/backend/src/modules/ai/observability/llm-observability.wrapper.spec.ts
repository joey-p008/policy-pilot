import { RecommendationSchema } from '../schemas/recommendation.schema';
import type { LlmObservabilityLogger } from './llm-observability.logger';
import type { LlmObservation } from './llm-observability.types';
import { executeWithObservability } from './llm-observability.wrapper';

describe('executeWithObservability', () => {
  const validRecommendation = {
    decision: 'ESCALATE',
    rationale: 'Policy context is insufficient to approve or deny.',
    policy_citations: [
      {
        document_id: 'pol-1',
        page_number: 2,
        section_title: 'Access Exceptions',
      },
    ],
    confidence_score: 0.25,
  };

  it('records prompt version, cost, latency, and schema validity on success', async () => {
    const observations: LlmObservation[] = [];
    const logger: LlmObservabilityLogger = {
      logObservation: (observation) => {
        observations.push(observation);
      },
    };

    const result = await executeWithObservability(
      {
        promptKey: 'system-policy',
        model: 'gpt-4o-mini',
        payload: {
          employee_id: 'E1234567',
          cost_center: 'CC-9001',
          request_id: 'req-1',
        },
        execute: async () => ({
          content: JSON.stringify(validRecommendation),
          inputTokens: 1000,
          outputTokens: 200,
        }),
      },
      RecommendationSchema,
      logger,
    );

    expect(result.data).toEqual(validRecommendation);
    expect(result.observation.promptName).toBe('system-policy');
    expect(result.observation.promptVersion).toBe('1.1.0');
    expect(result.observation.schemaValid).toBe(true);
    expect(result.observation.schemaErrors).toEqual([]);
    expect(result.observation.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.observation.estimatedCostUsd).toBeGreaterThan(0);
    expect(result.observation.inputPrompt).toContain('E1***67');
    expect(result.observation.inputPrompt).toContain('CC***01');
    expect(result.observation.inputPrompt).not.toContain('E1234567');
    expect(observations).toHaveLength(1);
  });

  it('returns null data and schemaValid false when model output fails Zod validation', async () => {
    const result = await executeWithObservability(
      {
        promptKey: 'rag-synthesis',
        model: 'gpt-4o-mini',
        payload: { request_id: 'req-2' },
        execute: async () => ({
          content: JSON.stringify({ decision: 'MAYBE' }),
          inputTokens: 10,
          outputTokens: 5,
        }),
      },
      RecommendationSchema,
      { logObservation: () => undefined },
    );

    expect(result.data).toBeNull();
    expect(result.observation.schemaValid).toBe(false);
    expect(result.observation.schemaErrors.length).toBeGreaterThan(0);
    expect(result.observation.promptVersion).toBe('1.0.0');
  });
});
