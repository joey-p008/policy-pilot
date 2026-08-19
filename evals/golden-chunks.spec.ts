import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadGoldenPolicyChunks, mapGoldenExcerptsToPolicyChunks } from './golden-chunks';

describe('mapGoldenExcerptsToPolicyChunks', () => {
  it('maps excerpts to policy chunks and drops duplicates', () => {
    const chunks = mapGoldenExcerptsToPolicyChunks([
      {
        document_id: 'POL-2026-01-DGW',
        page_number: 1,
        section_title: 'CLAUSE 3.0',
        excerpt: 'Baseline read access for CC-FIN-07.',
      },
      {
        document_id: 'POL-2026-01-DGW',
        page_number: 1,
        section_title: 'CLAUSE 3.0',
        excerpt: 'Baseline read access for CC-FIN-07.',
      },
      {
        document_id: 'POL-2026-02-IAM',
        page_number: 2,
        section_title: 'SOD',
        excerpt: 'Deny concurrent edit and export.',
      },
    ]);

    expect(chunks).toEqual([
      {
        document_id: 'POL-2026-01-DGW',
        page_number: 1,
        section_title: 'CLAUSE 3.0',
        content: 'Baseline read access for CC-FIN-07.',
      },
      {
        document_id: 'POL-2026-02-IAM',
        page_number: 2,
        section_title: 'SOD',
        content: 'Deny concurrent edit and export.',
      },
    ]);
  });
});

describe('loadGoldenPolicyChunks', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'policy-pilot-golden-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads unique chunks from the committed golden dataset', () => {
    const chunks = loadGoldenPolicyChunks();
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('reads expected_retrieved_chunks from a golden dataset file', () => {
    const datasetPath = join(tempDir, 'golden_dataset.json');
    writeFileSync(
      datasetPath,
      JSON.stringify([
        {
          expected_retrieved_chunks: [
            {
              document_id: 'POL-1',
              page_number: 1,
              section_title: 'Access',
              excerpt: 'Grant read access.',
            },
          ],
        },
        {
          expected_retrieved_chunks: [],
        },
      ]),
    );

    expect(loadGoldenPolicyChunks(datasetPath)).toEqual([
      {
        document_id: 'POL-1',
        page_number: 1,
        section_title: 'Access',
        content: 'Grant read access.',
      },
    ]);
  });
});
