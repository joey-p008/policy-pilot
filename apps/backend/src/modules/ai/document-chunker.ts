import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

import {
  ChunkDocumentInput,
  ChunkDocumentInputSchema,
  PolicyDocumentChunk,
  PolicyDocumentChunkSchema,
} from './dto/document-ingestion.dto';

export const DOCUMENT_CHUNK_SIZE = 1000;
export const DOCUMENT_CHUNK_OVERLAP = 200;
export const DEFAULT_SECTION_TITLE = 'General';

const HEADING_MAX_LENGTH = 160;
const NUMBERED_HEADING_PATTERN = /^\d+(\.\d+)*[.)]?\s+\S+/;
const CLAUSE_HEADING_PATTERN = /^CLAUSE\s+\d+(\.\d+)*\b/i;
const SECTION_HEADING_PATTERN = /^SECTION\s+\d+(\.\d+)*\b/i;
/** Policy articles use Roman numerals (ARTICLE III); Arabic "Article 32" is usually statutory prose. */
const ARTICLE_HEADING_PATTERN = /^Article\s+[IVXLCDM]+(\.\d+)*\b/i;
const APPENDIX_HEADING_PATTERN = /^Appendix\b/i;
const DOCUMENT_HEADER_PATTERN = /^POL-\d{4}-\d{2}-[A-Z]+/i;
/** Inline markers only when preceded by an em/en dash (not hyphenated prose like "opt-out"). */
const ARTICLE_INLINE_PATTERN = /[—–]\s*ARTICLE\s+[IVXLCDM]+\b/i;
const SECTION_INLINE_PATTERN = /[—–]\s*SECTION\s+\d+(\.\d+)*\b/i;
/** Title-case headings; allows hyphen and em dash. */
const TITLE_CASE_PATTERN = /^[A-Z][A-Za-z0-9/'&,:\-—() ]+$/;

interface TextSection {
  readonly title: string;
  readonly body: string;
}

export class DocumentChunker {
  private readonly splitter: RecursiveCharacterTextSplitter;

  public constructor(
    chunkSize: number = DOCUMENT_CHUNK_SIZE,
    chunkOverlap: number = DOCUMENT_CHUNK_OVERLAP,
  ) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  public async chunkDocument(input: ChunkDocumentInput): Promise<PolicyDocumentChunk[]> {
    const validated = ChunkDocumentInputSchema.parse(input);
    const trimmed = validated.text.trim();

    if (trimmed.length === 0) {
      return [];
    }

    const sections =
      validated.sectionTitle !== undefined
        ? [{ title: validated.sectionTitle, body: trimmed }]
        : this.splitIntoSections(trimmed);

    const chunks: PolicyDocumentChunk[] = [];

    for (const section of sections) {
      const parts = await this.splitter.splitText(section.body);
      for (const part of parts) {
        const content = part.trim();
        if (content.length === 0) {
          continue;
        }

        chunks.push(
          PolicyDocumentChunkSchema.parse({
            document_id: validated.documentId,
            page_number: validated.pageNumber,
            section_title: section.title,
            content,
          }),
        );
      }
    }

    return chunks;
  }

  private splitIntoSections(text: string): TextSection[] {
    const lines = text.split('\n');
    const sections: TextSection[] = [];
    let currentTitle = DEFAULT_SECTION_TITLE;
    let currentLines: string[] = [];

    const flush = (): void => {
      const body = currentLines.join('\n').trim();
      if (body.length === 0) {
        return;
      }
      sections.push({ title: currentTitle, body });
      currentLines = [];
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.length === 0) {
        currentLines.push(rawLine);
        continue;
      }

      if (this.isStructuralHeading(line)) {
        flush();
        currentTitle = this.normalizeHeading(line);
        currentLines.push(rawLine);
        continue;
      }

      currentLines.push(rawLine);
    }

    flush();

    if (sections.length === 0) {
      return [{ title: DEFAULT_SECTION_TITLE, body: text }];
    }

    return sections;
  }

  private normalizeHeading(line: string): string {
    const inlineMarker =
      /[—–]\s*((?:ARTICLE\s+[IVXLCDM]+(?:\.\d+)*)|(?:SECTION\s+\d+(?:\.\d+)*))\b(.*)$/i.exec(line);

    if (
      inlineMarker !== null &&
      !ARTICLE_HEADING_PATTERN.test(line) &&
      !SECTION_HEADING_PATTERN.test(line)
    ) {
      const marker = inlineMarker[1]?.trim() ?? '';
      const rest = (inlineMarker[2] ?? '').replace(/^[—–\-\s:]+/, '').trim();
      if (rest.length > 0) {
        return `${marker} — ${rest}`.replace(/\s+/g, ' ').trim();
      }
      const prefix = line
        .slice(0, inlineMarker.index)
        .replace(/[—–\-\s:]+$/g, '')
        .trim();
      if (prefix.length > 0) {
        return `${marker} — ${prefix}`.replace(/\s+/g, ' ').trim();
      }
      return marker;
    }

    return line;
  }

  private isStructuralHeading(line: string): boolean {
    if (line.length === 0 || line.length > HEADING_MAX_LENGTH) {
      return false;
    }

    if (DOCUMENT_HEADER_PATTERN.test(line)) {
      return false;
    }

    // PDF wrap fragments / front-matter lines are not section headings.
    if (
      /^[&*]/.test(line) ||
      /^(Promulgated|Issued|Effective Date|Document Version|CONFIDENTIAL|STRICTLY CONFIDENTIAL)\b/i.test(
        line,
      )
    ) {
      return false;
    }

    if (CLAUSE_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (SECTION_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (ARTICLE_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (APPENDIX_HEADING_PATTERN.test(line)) {
      return true;
    }

    // e.g. "FRAUD PREVENTION ... — ARTICLE V" / "... — SECTION 8.1"
    if (ARTICLE_INLINE_PATTERN.test(line) || SECTION_INLINE_PATTERN.test(line)) {
      return true;
    }

    if (NUMBERED_HEADING_PATTERN.test(line) && this.isNumberedSectionTitle(line)) {
      return true;
    }

    const wordCount = line.split(/\s+/).filter((word) => word.length > 0).length;

    // Require multi-word ALL CAPS / title-case lines to avoid wrap fragments like "GUARDRAILS".
    if (
      line === line.toUpperCase() &&
      /[A-Z]/.test(line) &&
      wordCount >= 3 &&
      wordCount <= 12 &&
      !this.looksLikeSentence(line)
    ) {
      return true;
    }

    if (
      TITLE_CASE_PATTERN.test(line) &&
      !line.endsWith('.') &&
      wordCount >= 3 &&
      wordCount <= 12 &&
      !this.looksLikeSentence(line)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Accept "3.0 Commercial Baseline..." / "5.0 Production Deployment..."
   * Reject body paragraphs like "1.1. This comprehensive operational directive..."
   */
  private isNumberedSectionTitle(line: string): boolean {
    const match = /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/.exec(line);
    if (match === null) {
      return false;
    }

    const number = match[1] ?? '';
    const rest = (match[2] ?? '').trim();
    if (rest.length === 0) {
      return false;
    }

    // Subsection body markers (1.1., 3.2., 5.3.) are almost always prose, not titles.
    const dottedParts = number.split('.');
    if (dottedParts.length >= 2 && dottedParts[dottedParts.length - 1] !== '0') {
      // Allow explicit title-like subsection headings that use an em dash.
      if (!/[—–-]/.test(rest) && !this.isTitleCasedPhrase(rest)) {
        return false;
      }
    }

    if (this.looksLikeSentence(rest)) {
      return false;
    }

    return this.isTitleCasedPhrase(rest) || rest === rest.toUpperCase();
  }

  private isTitleCasedPhrase(text: string): boolean {
    const words = text
      .replace(/[—–]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 0);
    if (words.length === 0 || words.length > 14) {
      return false;
    }

    let titleCaseWords = 0;
    for (const word of words) {
      if (/^[A-Z0-9]/.test(word)) {
        titleCaseWords += 1;
      }
    }

    return titleCaseWords / words.length >= 0.6;
  }

  private looksLikeSentence(text: string): boolean {
    if (/[.!?]$/.test(text)) {
      return true;
    }

    // Lowercase function-word starts / memo metadata are prose, not headings.
    if (
      /^(the|this|a|an|any|all|in|on|for|to|of|with|under|pursuant|specifically|furthermore|similarly|subject|from|to:)\b/i.test(
        text,
      )
    ) {
      return true;
    }

    const words = text.split(/\s+/);
    if (words.length >= 8) {
      const lowercase = words.filter((word) => /^[a-z]/.test(word)).length;
      if (lowercase / words.length >= 0.35) {
        return true;
      }
    }

    return false;
  }
}
