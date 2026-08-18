import { PolicyChunkRepository } from '../database/repositories/policy-chunk.repository';
import { EMBEDDING_DIMENSIONS, EmbeddingClient } from './embedding/embedding.types';
import { RETRIEVAL_CANDIDATE_LIMIT, RETRIEVAL_TOP_K, RetrievalService } from './retrieval.service';

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
    const request = {
      requestId: 'req-123',
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

    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledTimes(1);
    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledWith(
      queryEmbedding,
      RETRIEVAL_CANDIDATE_LIMIT,
      undefined,
    );
    expect(chunks).toHaveLength(4);
    expect(chunks[0]?.document_id).toBe('POL-2026-01');
  });

  it('includes business justification in the embedding query when provided', async () => {
    const queryEmbedding = buildMockEmbedding(3);
    mockEmbeddingClient.embedTexts.mockResolvedValue([queryEmbedding]);
    mockPolicyChunkRepository.findTopSimilar.mockResolvedValue([]);

    await service.retrieve({
      requestId: 'req-456',
      targetEntitlement: 'analytics-warehouse-writer',
      justification: 'Need write access for quarterly reporting',
    });

    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledWith([
      'Access entitlement request: analytics-warehouse-writer. Business justification: Need write access for quarterly reporting',
    ]);
  });

  it('includes structured context fields in the embedding query', async () => {
    const queryEmbedding = buildMockEmbedding(9);
    mockEmbeddingClient.embedTexts.mockResolvedValue([queryEmbedding]);
    mockPolicyChunkRepository.findTopSimilar.mockResolvedValue([]);

    await service.retrieve({
      requestId: 'req-789',
      targetEntitlement: 'FIN_BILLING_EXPORT',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      targetResource: 'DATA_WAREHOUSE / FIN_DATASET',
      currentEntitlements: ['FIN_DATASET_EDIT'],
      justification: 'Requester needs bulk billing export',
    });

    expect(mockEmbeddingClient.embedTexts).toHaveBeenCalledWith([
      'Access entitlement request: FIN_BILLING_EXPORT. Requester title: Data Analyst. Department: Finance Analytics. Cost center: CC-FIN-07. Target resource: DATA_WAREHOUSE / FIN_DATASET. Current entitlements: FIN_DATASET_EDIT. Business justification: Requester needs bulk billing export',
    ]);
    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledWith(
      queryEmbedding,
      RETRIEVAL_CANDIDATE_LIMIT,
      {
        documentIdPrefix: 'POL-2026-01-DGW',
      },
    );
  });

  it('does not request a cloud-policy prefix for a DATA_WAREHOUSE target', async () => {
    const queryEmbedding = buildMockEmbedding(2);
    mockEmbeddingClient.embedTexts.mockResolvedValue([queryEmbedding]);
    mockPolicyChunkRepository.findTopSimilar.mockResolvedValue([]);

    await service.retrieve({
      requestId: 'req-dw',
      targetEntitlement: 'FIN_DATASET_READ',
      targetResource: 'DATA_WAREHOUSE',
    });

    expect(mockPolicyChunkRepository.findTopSimilar).toHaveBeenCalledWith(
      queryEmbedding,
      RETRIEVAL_CANDIDATE_LIMIT,
      {
        documentIdPrefix: 'POL-2026-01-DGW',
      },
    );
    expect(mockPolicyChunkRepository.findTopSimilar).not.toHaveBeenCalledWith(
      queryEmbedding,
      RETRIEVAL_CANDIDATE_LIMIT,
      expect.objectContaining({ documentIdPrefix: 'POL-2026-02-SEC' }),
    );
  });

  it('deprioritizes General overlap chunks while still returning k=4', async () => {
    const queryEmbedding = buildMockEmbedding(11);
    mockEmbeddingClient.embedTexts.mockResolvedValue([queryEmbedding]);
    mockPolicyChunkRepository.findTopSimilar.mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 2,
        sectionTitle: 'General',
        content: 'Overlap preamble for CRM policy.',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 1,
        sectionTitle: '4.0 NON-COMMERCIAL DEPARTMENT ACCESS ROUTING & ESCALATIONS',
        content: 'Non-commercial cost centers must ESCALATE.',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 1,
        sectionTitle: 'General',
        content: 'Another overlap fragment.',
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 1,
        sectionTitle: '5.0 BULK DATA EXPORT RESTRICTIONS, DPO APPROVAL & TIME-BOXING RULES',
        content: 'CRM_EXPORT_BULK requires DPO sign-off.',
      },
      {
        id: '55555555-5555-5555-5555-555555555555',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 1,
        sectionTitle: '3.0 COMMERCIAL BASELINE ENTITLEMENTS BY DEPARTMENT',
        content: 'CC-SALES-03 qualifies for CRM_LEAD_EDIT.',
      },
      {
        id: '66666666-6666-6666-6666-666666666666',
        documentId: 'POL-2026-03-CRM',
        pageNumber: 2,
        sectionTitle: 'SECTION 7.1 — PCI-DSS SEPARATION OF DUTIES (SoD) CONFLICT MANDATE',
        content: 'CRM_EXPORT_BULK and CRM_CREDIT_CARD_VIEW may not coexist.',
      },
    ]);

    const chunks = await service.retrieve({
      requestId: 'req-general',
      targetEntitlement: 'CRM_EXPORT_BULK',
      targetResource: 'CRM_SYSTEM',
    });

    expect(RETRIEVAL_CANDIDATE_LIMIT).toBe(8);
    expect(chunks).toHaveLength(4);
    expect(chunks.map((chunk) => chunk.section_title)).toEqual([
      '4.0 NON-COMMERCIAL DEPARTMENT ACCESS ROUTING & ESCALATIONS',
      '5.0 BULK DATA EXPORT RESTRICTIONS, DPO APPROVAL & TIME-BOXING RULES',
      '3.0 COMMERCIAL BASELINE ENTITLEMENTS BY DEPARTMENT',
      'SECTION 7.1 — PCI-DSS SEPARATION OF DUTIES (SoD) CONFLICT MANDATE',
    ]);
  });
});
