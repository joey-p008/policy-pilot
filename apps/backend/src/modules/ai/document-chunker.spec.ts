import { DEFAULT_SECTION_TITLE, DOCUMENT_CHUNK_SIZE, DocumentChunker } from './document-chunker';
import { PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';

describe('DocumentChunker', () => {
  const chunker = new DocumentChunker();

  it('splits a long dummy document into chunks with content and metadata', async () => {
    const paragraph =
      'Access control policies require least privilege for all production systems. ';
    const dummyDocument = `${'Access Control Requirements\n'}${paragraph.repeat(40)}`;

    expect(dummyDocument.length).toBeGreaterThan(DOCUMENT_CHUNK_SIZE);

    const chunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-ACCESS',
      pageNumber: 2,
      text: dummyDocument,
    });

    expect(chunks.length).toBeGreaterThan(1);

    for (const chunk of chunks) {
      const parsed = PolicyDocumentChunkSchema.parse(chunk);

      expect(parsed.content.length).toBeGreaterThan(0);
      expect(parsed.document_id).toBe('POL-TEST-ACCESS');
      expect(parsed.page_number).toBe(2);
      expect(parsed.section_title.length).toBeGreaterThan(0);
    }

    expect(chunks[0]?.section_title).toBe('Access Control Requirements');
  });

  it('uses an explicit section title when provided', async () => {
    const chunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-EXPLICIT',
      pageNumber: 1,
      text: 'Employees must complete security training annually.',
      sectionTitle: 'Security Training',
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      document_id: 'POL-TEST-EXPLICIT',
      page_number: 1,
      section_title: 'Security Training',
      content: 'Employees must complete security training annually.',
    });
  });

  it('defaults section title when no heading-like line is present', async () => {
    const chunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-GENERAL',
      pageNumber: 3,
      text: 'all production secrets must be rotated every ninety days without exception.',
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.section_title).toBe(DEFAULT_SECTION_TITLE);
  });

  it('returns an empty array for blank text', async () => {
    const chunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-EMPTY',
      pageNumber: 1,
      text: '   \n\t  ',
    });

    expect(chunks).toEqual([]);
  });
});
