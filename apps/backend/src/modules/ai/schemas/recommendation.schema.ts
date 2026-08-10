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
