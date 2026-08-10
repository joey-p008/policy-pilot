import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AccessRequestsHitlController } from './access-requests-hitl.controller';
import { HitlAccessRequestsService } from './hitl-access-requests.service';

describe('AccessRequestsHitlController', () => {
  let app: INestApplication<App>;

  const mockHitlService: jest.Mocked<
    Pick<
      HitlAccessRequestsService,
      'createWithRecommendation' | 'listPending' | 'approve' | 'deny' | 'escalate'
    >
  > = {
    createWithRecommendation: jest.fn(),
    listPending: jest.fn(),
    approve: jest.fn(),
    deny: jest.fn(),
    escalate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccessRequestsHitlController],
      providers: [
        {
          provide: HitlAccessRequestsService,
          useValue: mockHitlService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects create payloads with empty justification', async () => {
    await request(app.getHttpServer())
      .post('/access-requests')
      .send({ targetEntitlement: 'prod-postgres-admin', justification: '' })
      .expect(400);

    expect(mockHitlService.createWithRecommendation).not.toHaveBeenCalled();
  });

  it('creates a request and returns the pending DTO', async () => {
    mockHitlService.createWithRecommendation.mockResolvedValue({
      requestId: 'req-1',
      employeeId: 'E-MOCK-042',
      targetEntitlement: 'prod-postgres-admin',
      justification: 'Incident response',
      currentEntitlements: ['payroll-api:read'],
      recommendation: {
        decision: 'DENY',
        rationale: 'Need ticket',
        confidenceScore: 0.9,
        policyCitations: [],
      },
    });

    const response = await request(app.getHttpServer())
      .post('/access-requests')
      .send({
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Incident response',
      })
      .expect(201);

    expect(response.body.requestId).toBe('req-1');
    expect(response.body.recommendation.decision).toBe('DENY');
  });

  it('escalates via POST /access-requests/:id/escalate', async () => {
    mockHitlService.escalate.mockResolvedValue({
      requestId: 'req-1',
      status: 'escalated',
    });

    const response = await request(app.getHttpServer())
      .post('/access-requests/req-1/escalate')
      .send({ admin_id: 'admin-123' })
      .expect(200);

    expect(response.body).toEqual({ requestId: 'req-1', status: 'escalated' });
    expect(mockHitlService.escalate).toHaveBeenCalledWith('req-1', 'admin-123');
  });
});
