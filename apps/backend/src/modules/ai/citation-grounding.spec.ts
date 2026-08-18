import { groundDecisionCitations, measureCitationGrounding } from './citation-grounding';
import type { PolicyDocumentChunk } from './dto/document-ingestion.dto';
import type { Decision } from './schemas/recommendation.schema';

describe('groundDecisionCitations', () => {
  const chunks: PolicyDocumentChunk[] = [
    {
      document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
      page_number: 1,
      section_title:
        'CLAUSE 3.2 — Departmental Cost Center Registration & Baseline Read Privileges',
      content: 'CC-FIN-07 qualifies for FIN_DATASET_READ.',
    },
    {
      document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
      page_number: 2,
      section_title: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
      content: 'FIN_DATASET_EDIT and FIN_BILLING_EXPORT may not coexist.',
    },
  ];

  it('remaps citations to verbatim retrieved chunk metadata', () => {
    const decision: Decision = {
      decision: 'APPROVE',
      rationale: 'Baseline cost center match.',
      policy_citations: [
        {
          document_id: 'POL-2026-01-DGW',
          page_number: 1,
          section_title:
            'Clause 3.2 — Departmental Cost Center Registration & Baseline Read Privileges',
        },
      ],
      confidence_score: 0.95,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded.decision).toBe('APPROVE');
    expect(grounded.policy_citations).toEqual([
      {
        document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
        page_number: 1,
        section_title:
          'CLAUSE 3.2 — Departmental Cost Center Registration & Baseline Read Privileges',
      },
    ]);
  });

  it('drops ungrounded citations and forces ESCALATE for APPROVE', () => {
    const decision: Decision = {
      decision: 'APPROVE',
      rationale: 'Invented citation.',
      policy_citations: [
        {
          document_id: 'POL-9999-99-ZZZ',
          page_number: 99,
          section_title: 'Made Up Section',
        },
      ],
      confidence_score: 0.99,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded.decision).toBe('ESCALATE');
    expect(grounded.policy_citations).toEqual([]);
    expect(grounded.confidence_score).toBeLessThanOrEqual(0.39);
  });

  it('keeps DENY when citations cannot be grounded', () => {
    const decision: Decision = {
      decision: 'DENY',
      rationale: 'Jailbreak attempt rejected.',
      policy_citations: [
        {
          document_id: 'POL-9999-99-ZZZ',
          page_number: 99,
          section_title: 'Made Up Section',
        },
      ],
      confidence_score: 0.99,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded.decision).toBe('DENY');
    expect(grounded.policy_citations).toEqual([]);
    expect(grounded.rationale).toBe('Jailbreak attempt rejected.');
  });

  it('keeps ESCALATE when citations cannot be grounded', () => {
    const decision: Decision = {
      decision: 'ESCALATE',
      rationale: 'Insufficient context.',
      policy_citations: [
        {
          document_id: 'POL-9999-99-ZZZ',
          page_number: 1,
          section_title: 'Missing',
        },
      ],
      confidence_score: 0.2,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded.decision).toBe('ESCALATE');
    expect(grounded.policy_citations).toEqual([]);
    expect(grounded.rationale).toBe('Insufficient context.');
  });

  it('preserves DENY with intentionally empty citations', () => {
    const decision: Decision = {
      decision: 'DENY',
      rationale: 'Prompt injection attempt rejected.',
      policy_citations: [],
      confidence_score: 1,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded).toEqual(decision);
  });

  it('deduplicates remapped citations', () => {
    const decision: Decision = {
      decision: 'DENY',
      rationale: 'SoD conflict.',
      policy_citations: [
        {
          document_id: 'POL-2026-01-DGW',
          page_number: 2,
          section_title: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
        },
        {
          document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
          page_number: 2,
          section_title: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
        },
      ],
      confidence_score: 1,
    };

    const grounded = groundDecisionCitations(decision, chunks);

    expect(grounded.policy_citations).toHaveLength(1);
    expect(grounded.decision).toBe('DENY');
  });
});

describe('measureCitationGrounding', () => {
  const chunks: PolicyDocumentChunk[] = [
    {
      document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
      page_number: 1,
      section_title:
        'CLAUSE 3.2 — Departmental Cost Center Registration & Baseline Read Privileges',
      content: 'CC-FIN-07 qualifies for FIN_DATASET_READ.',
    },
    {
      document_id: 'POL-2026-01-DGW_Data_Infrastructure_Policy',
      page_number: 2,
      section_title: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
      content: 'FIN_DATASET_EDIT and FIN_BILLING_EXPORT may not coexist.',
    },
  ];

  it('scores 1 when every emitted citation maps onto retrieved chunks', () => {
    const decision: Decision = {
      decision: 'APPROVE',
      rationale: 'Baseline cost center match.',
      policy_citations: [
        {
          document_id: 'POL-2026-01-DGW',
          page_number: 1,
          section_title:
            'Clause 3.2 — Departmental Cost Center Registration & Baseline Read Privileges',
        },
      ],
      confidence_score: 0.95,
    };

    expect(measureCitationGrounding(decision, chunks)).toEqual({
      emittedCount: 1,
      groundedCount: 1,
      citationHitRate: 1,
    });
  });

  it('scores the fraction of LLM citations that map onto retrieved chunks', () => {
    const decision: Decision = {
      decision: 'DENY',
      rationale: 'Mixed citations.',
      policy_citations: [
        {
          document_id: 'POL-2026-01-DGW',
          page_number: 2,
          section_title: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
        },
        {
          document_id: 'POL-9999-99-ZZZ',
          page_number: 99,
          section_title: 'Made Up Section',
        },
      ],
      confidence_score: 0.9,
    };

    expect(measureCitationGrounding(decision, chunks)).toEqual({
      emittedCount: 2,
      groundedCount: 1,
      citationHitRate: 0.5,
    });
  });

  it('scores empty APPROVE citations as 0', () => {
    const decision: Decision = {
      decision: 'APPROVE',
      rationale: 'No citations.',
      policy_citations: [],
      confidence_score: 0.9,
    };

    expect(measureCitationGrounding(decision, chunks).citationHitRate).toBe(0);
  });

  it('scores empty DENY and ESCALATE citations as 1', () => {
    const deny: Decision = {
      decision: 'DENY',
      rationale: 'Prompt injection rejected.',
      policy_citations: [],
      confidence_score: 1,
    };
    const escalate: Decision = {
      decision: 'ESCALATE',
      rationale: 'Insufficient context.',
      policy_citations: [],
      confidence_score: 0.2,
    };

    expect(measureCitationGrounding(deny, chunks).citationHitRate).toBe(1);
    expect(measureCitationGrounding(escalate, chunks).citationHitRate).toBe(1);
  });
});
