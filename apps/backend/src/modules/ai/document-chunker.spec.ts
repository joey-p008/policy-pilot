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

  it('detects CLAUSE, SECTION, and Appendix policy headings', async () => {
    const clauseChunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-CLAUSE',
      pageNumber: 1,
      text: 'CLAUSE 3.2 — Departmental Cost Center Registration\nPersonnel in CC-FIN-07 qualify for baseline read access.',
    });
    expect(clauseChunks[0]?.section_title).toBe(
      'CLAUSE 3.2 — Departmental Cost Center Registration',
    );

    const sectionChunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-SECTION',
      pageNumber: 1,
      text: 'SECTION 5.0 — Bulk Data Export Restrictions\nBulk exports require DPO approval.',
    });
    expect(sectionChunks[0]?.section_title).toBe('SECTION 5.0 — Bulk Data Export Restrictions');

    const appendixChunks = await chunker.chunkDocument({
      documentId: 'POL-TEST-APPENDIX',
      pageNumber: 2,
      text: 'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules\nFIN_DATASET_EDIT and FIN_BILLING_EXPORT may not coexist.',
    });
    expect(appendixChunks[0]?.section_title).toBe(
      'Appendix B — Separation of Duties (SoD) & Anti-Fraud Conflict Rules',
    );
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
