import { z } from 'zod';

export const PolicyCitationSchema = z.object({
  document_id: z.string().min(1),
  page_number: z.number().int().positive(),
  section_title: z.string().min(1),
});

export const RecommendationDecisionSchema = z.enum(['APPROVE', 'DENY', 'ESCALATE']);

export const RecommendationSchema = z.object({
  decision: RecommendationDecisionSchema,
  rationale: z.string().min(1),
  policy_citations: z.array(PolicyCitationSchema),
  confidence_score: z.number().min(0).max(1),
});

export type PolicyCitation = z.infer<typeof PolicyCitationSchema>;
export type RecommendationDecision = z.infer<typeof RecommendationDecisionSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;

/** Structured decision-engine output; identical to RecommendationSchema. */
export const DecisionSchema = RecommendationSchema;
export type Decision = Recommendation;

/**
 * OpenAI strict JSON Schema for DecisionSchema.
 * Additional properties are disallowed so the model cannot invent alternate keys.
 */
export const DecisionJsonSchema: Readonly<Record<string, unknown>> = {
  type: 'object',
  additionalProperties: false,
  required: ['decision', 'rationale', 'policy_citations', 'confidence_score'],
  properties: {
    decision: {
      type: 'string',
      enum: ['APPROVE', 'DENY', 'ESCALATE'],
    },
    rationale: {
      type: 'string',
    },
    policy_citations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['document_id', 'page_number', 'section_title'],
        properties: {
          document_id: { type: 'string' },
          page_number: { type: 'integer' },
          section_title: { type: 'string' },
        },
      },
    },
    confidence_score: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
  },
};

export const DECISION_JSON_SCHEMA_NAME = 'access_decision';
