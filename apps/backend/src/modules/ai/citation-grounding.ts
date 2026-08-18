import type { PolicyDocumentChunk } from './dto/document-ingestion.dto';
import type { Decision, PolicyCitation } from './schemas/recommendation.schema';

const UNGROUNDED_ESCALATE_CONFIDENCE = 0.25;
const UNGROUNDED_ESCALATE_RATIONALE =
  'Unable to ground policy citations in the retrieved policy context; escalating for human review.';

function normalizeDocumentId(documentId: string): string {
  const match = /^POL-\d{4}-\d{2}-[A-Z]+/i.exec(documentId.trim());
  if (match !== null) {
    return match[0].toUpperCase();
  }
  return documentId.trim().toUpperCase();
}

function documentIdsMatch(left: string, right: string): boolean {
  const a = left.trim();
  const b = right.trim();
  if (a === b) {
    return true;
  }
  if (a.startsWith(`${b}_`) || b.startsWith(`${a}_`)) {
    return true;
  }
  return normalizeDocumentId(a) === normalizeDocumentId(b);
}

function normalizeSectionTitle(title: string): string {
  return title.trim().toLowerCase().replace(/[—–]/g, '-').replace(/\s+/g, ' ');
}

function sectionTitlesMatch(left: string, right: string): boolean {
  const a = normalizeSectionTitle(left);
  const b = normalizeSectionTitle(right);
  if (a === b) {
    return true;
  }
  if (a.length === 0 || b.length === 0) {
    return false;
  }
  return a.includes(b) || b.includes(a);
}

function citationKey(citation: {
  document_id: string;
  page_number: number;
  section_title: string;
}): string {
  return `${normalizeDocumentId(citation.document_id)}|${citation.page_number}|${normalizeSectionTitle(citation.section_title)}`;
}

function scoreChunkMatch(citation: PolicyCitation, chunk: PolicyDocumentChunk): number {
  if (!documentIdsMatch(citation.document_id, chunk.document_id)) {
    return -1;
  }

  let score = 0;
  if (citation.page_number === chunk.page_number) {
    score += 3;
  }
  if (sectionTitlesMatch(citation.section_title, chunk.section_title)) {
    score += 4;
  } else if (normalizeSectionTitle(chunk.section_title) === 'general') {
    // Prefer same-document/page General chunks when the model invents a title.
    score += 1;
  }

  return score;
}

function mapCitationToChunk(
  citation: PolicyCitation,
  chunks: ReadonlyArray<PolicyDocumentChunk>,
): PolicyDocumentChunk | undefined {
  let best: PolicyDocumentChunk | undefined;
  let bestScore = 0;

  for (const chunk of chunks) {
    const score = scoreChunkMatch(citation, chunk);
    if (score > bestScore) {
      bestScore = score;
      best = chunk;
    }
  }

  // Require at least document + (page or section) signal.
  if (best === undefined || bestScore < 3) {
    return undefined;
  }

  return best;
}

export interface CitationGroundingMeasurement {
  readonly emittedCount: number;
  readonly groundedCount: number;
  readonly citationHitRate: number;
}

/**
 * Deterministic citation-hit rate: grounded LLM citations / emitted LLM citations.
 * Empty APPROVE citations score 0; empty DENY/ESCALATE citations score 1 (intentional).
 */
export function measureCitationGrounding(
  decision: Decision,
  policyChunks: ReadonlyArray<PolicyDocumentChunk>,
): CitationGroundingMeasurement {
  const emittedCount = decision.policy_citations.length;
  if (emittedCount === 0) {
    return {
      emittedCount: 0,
      groundedCount: 0,
      citationHitRate: decision.decision === 'APPROVE' ? 0 : 1,
    };
  }

  let groundedCount = 0;
  for (const citation of decision.policy_citations) {
    if (mapCitationToChunk(citation, policyChunks) !== undefined) {
      groundedCount += 1;
    }
  }

  return {
    emittedCount,
    groundedCount,
    citationHitRate: groundedCount / emittedCount,
  };
}

/**
 * Remaps LLM citations onto retrieved chunk metadata and drops ungrounded citations.
 * If APPROVE/DENY would be left with zero grounded citations, forces ESCALATE.
 */
export function groundDecisionCitations(
  decision: Decision,
  policyChunks: ReadonlyArray<PolicyDocumentChunk>,
): Decision {
  const grounded: PolicyCitation[] = [];
  const seen = new Set<string>();

  for (const citation of decision.policy_citations) {
    const matched = mapCitationToChunk(citation, policyChunks);
    if (matched === undefined) {
      continue;
    }

    const remapped: PolicyCitation = {
      document_id: matched.document_id,
      page_number: matched.page_number,
      section_title: matched.section_title,
    };
    const key = citationKey(remapped);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    grounded.push(remapped);
  }

  if (grounded.length > 0) {
    return {
      ...decision,
      policy_citations: grounded,
    };
  }

  // Preserve intentionally uncited outputs and safe DENY/ESCALATE decisions.
  if (
    decision.policy_citations.length === 0 ||
    decision.decision === 'ESCALATE' ||
    decision.decision === 'DENY'
  ) {
    return {
      ...decision,
      policy_citations: [],
    };
  }

  // APPROVE without grounded citations is unsafe — escalate for human review.
  return {
    decision: 'ESCALATE',
    rationale: UNGROUNDED_ESCALATE_RATIONALE,
    policy_citations: [],
    confidence_score: UNGROUNDED_ESCALATE_CONFIDENCE,
  };
}
