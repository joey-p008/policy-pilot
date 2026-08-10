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
const APPENDIX_HEADING_PATTERN = /^Appendix\b/i;
const TITLE_CASE_PATTERN = /^[A-Z][A-Za-z0-9/'&,:\- ]+$/;

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

    const parts = await this.splitter.splitText(trimmed);
    const chunks: PolicyDocumentChunk[] = [];

    for (const part of parts) {
      const content = part.trim();
      if (content.length === 0) {
        continue;
      }

      const sectionTitle =
        validated.sectionTitle ?? this.resolveSectionTitle(content) ?? DEFAULT_SECTION_TITLE;

      chunks.push(
        PolicyDocumentChunkSchema.parse({
          document_id: validated.documentId,
          page_number: validated.pageNumber,
          section_title: sectionTitle,
          content,
        }),
      );
    }

    return chunks;
  }

  private resolveSectionTitle(content: string): string | undefined {
    const firstLine = content
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (firstLine === undefined) {
      return undefined;
    }

    if (!this.isHeadingLike(firstLine)) {
      return undefined;
    }

    return firstLine;
  }

  private isHeadingLike(line: string): boolean {
    if (line.length === 0 || line.length > HEADING_MAX_LENGTH) {
      return false;
    }

    if (CLAUSE_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (SECTION_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (APPENDIX_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (NUMBERED_HEADING_PATTERN.test(line)) {
      return true;
    }

    if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.split(/\s+/).length <= 12) {
      return true;
    }

    if (TITLE_CASE_PATTERN.test(line) && !line.endsWith('.') && line.split(/\s+/).length <= 12) {
      return true;
    }

    return false;
  }
}
