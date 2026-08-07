jest.mock('pdf-parse', () => ({
  PDFParse: jest.fn(),
}));

import { PolicyChunkRepository } from '../database/repositories/policy-chunk.repository';
import { DocumentIngestionService } from './document-ingestion.service';
import { PolicyDocumentChunk } from './dto/document-ingestion.dto';
import { EMBEDDING_DIMENSIONS, EmbeddingClient } from './embedding/embedding.types';

function buildMockEmbedding(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (seed + index) * 0.0001);
}

describe('DocumentIngestionService (ai-ingestion)', () => {
  const mockEmbeddingClient: jest.Mocked<EmbeddingClient> = {
    embedTexts: jest.fn(),
  };

  const mockPolicyChunkRepository: jest.Mocked<
    Pick<PolicyChunkRepository, 'deleteByDocumentId' | 'bulkInsert'>
  > = {
    deleteByDocumentId: jest.fn(),
    bulkInsert: jest.fn(),
  };

  let service: DocumentIngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentIngestionService(
      mockEmbeddingClient,
      mockPolicyChunkRepository as unknown as PolicyChunkRepository,
    );
  });

  it('maps mock embeddings onto chunks and writes them via the repository', async () => {
    const chunks: PolicyDocumentChunk[] = [
      {
        document_id: 'POL-TEST-ACCESS',
        page_number: 1,
        section_title: 'Access Control',
        content: 'Least privilege is required for production systems.',
      },
      {
        document_id: 'POL-TEST-ACCESS',
        page_number: 2,
        section_title: 'Audit Logging',
        content: 'All access grants must be recorded in the audit log.',
      },
    ];

    const embeddingOne = buildMockEmbedding(1);
    const embeddingTwo = buildMockEmbedding(2);

    mockEmbeddingClient.embedTexts.mockResolvedValue([embeddingOne, embeddingTwo]);
    mockPolicyChunkRepository.deleteByDocumentId.mockResolvedValue(0);
    mockPolicyChunkRepository.bulkInsert.mockResolvedValue(2);

    const inserted = await service.persistChunks(chunks);

    expect(inserted).toBe(2);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledTimes(1);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledWith([
      'Least privilege is required for production systems.',
      'All access grants must be recorded in the audit log.',
    ]);
    expect(mockPolicyChunkRepository.deleteByDocumentId).toHaveBeenCalledWith('POL-TEST-ACCESS');
    expect(mockPolicyChunkRepository.bulkInsert).toHaveBeenCalledTimes(1);
    expect(mockPolicyChunkRepository.bulkInsert).toHaveBeenCalledWith([
      {
        documentId: 'POL-TEST-ACCESS',
        pageNumber: 1,
        sectionTitle: 'Access Control',
        content: 'Least privilege is required for production systems.',
        embedding: embeddingOne,
      },
      {
        documentId: 'POL-TEST-ACCESS',
        pageNumber: 2,
        sectionTitle: 'Audit Logging',
        content: 'All access grants must be recorded in the audit log.',
        embedding: embeddingTwo,
      },
    ]);
  });

  it('deletes and inserts per document when chunks span multiple documents', async () => {
    const chunks: PolicyDocumentChunk[] = [
      {
        document_id: 'POL-A',
        page_number: 1,
        section_title: 'General',
        content: 'Document A chunk.',
      },
      {
        document_id: 'POL-B',
        page_number: 1,
        section_title: 'General',
        content: 'Document B chunk.',
      },
    ];

    mockEmbeddingClient.embedTexts
      .mockResolvedValueOnce([buildMockEmbedding(10)])
      .mockResolvedValueOnce([buildMockEmbedding(20)]);
    mockPolicyChunkRepository.deleteByDocumentId.mockResolvedValue(0);
    mockPolicyChunkRepository.bulkInsert.mockResolvedValue(1);

    const inserted = await service.persistChunks(chunks);

    expect(inserted).toBe(2);
    expect(mockPolicyChunkRepository.deleteByDocumentId).toHaveBeenCalledWith('POL-A');
    expect(mockPolicyChunkRepository.deleteByDocumentId).toHaveBeenCalledWith('POL-B');
    expect(mockPolicyChunkRepository.bulkInsert).toHaveBeenCalledTimes(2);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenNthCalledWith(1, ['Document A chunk.']);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenNthCalledWith(2, ['Document B chunk.']);
  });

  it('returns zero and skips embedding when there are no chunks', async () => {
    const inserted = await service.persistChunks([]);

    expect(inserted).toBe(0);
    expect(mockEmbeddingClient.embedTexts).not.toHaveBeenCalled();
    expect(mockPolicyChunkRepository.bulkInsert).not.toHaveBeenCalled();
  });
});
