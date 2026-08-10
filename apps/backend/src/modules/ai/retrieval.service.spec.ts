import { AccessRequestDto } from '../access-requests/dto/access-requests.dto';
import { PolicyChunkRepository } from '../database/repositories/policy-chunk.repository';
import { EMBEDDING_DIMENSIONS, EmbeddingClient } from './embedding/embedding.types';
import { RETRIEVAL_TOP_K, RetrievalService } from './retrieval.service';

function buildMockEmbedding(seed: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => (seed + index) * 0.0001);
}

describe('RetrievalService', () => {
  const mockEmbeddingClient: jest.Mocked<EmbeddingClient> = {
    embedTexts: jest.fn(),
  };

  const mockPolicyChunkRepository: jest.Mocked<Pick<PolicyChunkRepository, 'findTopSimilar'>> = {
    findTopSimilar: jest.fn(),
  };

  let service: RetrievalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RetrievalService(
      mockEmbeddingClient,
      mockPolicyChunkRepository as unknown as PolicyChunkRepository,
    );
  });

  it('embeds the entitlement query and enforces the k=4 similarity limit', async () => {
    const request: AccessRequestDto = {
      requestId: 'req-123',
      employeeId: 'emp-secret-999',
      targetEntitlement: 'prod-postgres-admin',
    };

    const queryEmbedding = buildMockEmbedding(7);
    mockEmbeddingClient.embedTexts.mockResolvedValue([queryEmbedding]);
    mockPolicyChunkRepository.findTopSimilar.mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        documentId: 'POL-2026-01',
        pageNumber: 1,
        sectionTitle: 'Access Control',
        content: 'Production admin access requires manager approval.',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        documentId: 'POL-2026-01',
        pageNumber: 2,
        sectionTitle: 'Least Privilege',
        content: 'Grant only the minimum entitlement required.',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        documentId: 'POL-2026-02',
        pageNumber: 3,
        sectionTitle: 'Cloud IAM',
        content: 'Privileged cloud roles must be time-bound.',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        documentId: 'POL-2026-02',
        pageNumber: 4,
        sectionTitle: 'Audit',
        content: 'All privileged access must be audited.',
      },
    ]);

    const chunks = await service.retrieve(request);

    expect(RETRIEVAL_TOP_K).toBe(4);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledTimes(1);
    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledWith([
      'Access entitlement request: prod-postgres-admin',
    ]);
    expect(mockEmbeddingClient.embedTexts.mock.calls[0]?.[0].join(' ')).not.toContain(
      'emp-secret-999',
    );

    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledTimes(1);
    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledWith(
      queryEmbedding,
      RETRIEVAL_TOP_K,
    );
    expect(mockPolicyChunkRepository.findTopSimilar.mock.calls[0]?.[1]).toBe(4);

    expect(chunks).toHaveLength(4);
    expect(chunks).toEqual([
      {
        document_id: 'POL-2026-01',
        page_number: 1,
        section_title: 'Access Control',
        content: 'Production admin access requires manager approval.',
      },
      {
        document_id: 'POL-2026-01',
        page_number: 2,
        section_title: 'Least Privilege',
        content: 'Grant only the minimum entitlement required.',
      },
      {
        document_id: 'POL-2026-02',
        page_number: 3,
        section_title: 'Cloud IAM',
        content: 'Privileged cloud roles must be time-bound.',
      },
      {
        document_id: 'POL-2026-02',
        page_number: 4,
        section_title: 'Audit',
        content: 'All privileged access must be audited.',
      },
    ]);
  });
});
