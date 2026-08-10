import { DecisionSchema } from './recommendation.schema';

describe('DecisionSchema', () => {
  const validDecision = {
    decision: 'APPROVE' as const,
    rationale: 'Policy section Access Control permits the requested entitlement.',
    policy_citations: [
      {
        document_id: 'POL-2026-01',
        page_number: 2,
        section_title: 'Access Control',
      },
    ],
    confidence_score: 0.82,
  };

  it('parses valid LLM mock JSON into a Decision object', () => {
    const parsed = DecisionSchema.parse(validDecision);

    expect(parsed).toEqual(validDecision);
    expect(parsed.decision).toBe('APPROVE');
    expect(parsed.confidence_score).toBeGreaterThanOrEqual(0);
    expect(parsed.confidence_score).toBeLessThanOrEqual(1);
  });

  it('fails Zod validation for unformatted prose text', () => {
    const result = DecisionSchema.safeParse('I think we should approve this.');

    expect(result.success).toBe(false);
    expect(() => DecisionSchema.parse('I think we should approve this.')).toThrow();
  });

  it('fails Zod validation for unauthorized SQL text from a mocked LLM response', () => {
    const sqlPayload = 'DROP TABLE users; --';
    const result = DecisionSchema.safeParse(sqlPayload);

    expect(result.success).toBe(false);
    expect(() => DecisionSchema.parse(sqlPayload)).toThrow();
  });
});
