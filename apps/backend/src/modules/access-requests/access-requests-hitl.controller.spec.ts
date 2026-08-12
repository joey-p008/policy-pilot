import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import {
  DEMO_ACTOR_ID_HEADER,
  DEMO_PRINCIPALS,
  DEMO_ROLE_HEADER,
} from '../auth/demo-auth.constants';
import { DemoAuthGuard } from '../auth/demo-auth.guard';
import { AccessRequestsHitlController } from './access-requests-hitl.controller';
import { HitlAccessRequestsService } from './hitl-access-requests.service';

const adminHeaders = {
  [DEMO_ROLE_HEADER]: 'admin',
  [DEMO_ACTOR_ID_HEADER]: DEMO_PRINCIPALS.admin.actorId,
};

const userHeaders = {
  [DEMO_ROLE_HEADER]: 'user',
  [DEMO_ACTOR_ID_HEADER]: DEMO_PRINCIPALS.user.actorId,
};

describe('AccessRequestsHitlController', () => {
  let app: INestApplication<App>;

  const mockHitlService: jest.Mocked<
    Pick<
      HitlAccessRequestsService,
      'createWithRecommendation' | 'listPending' | 'listHistory' | 'approve' | 'deny' | 'escalate'
    >
  > = {
    createWithRecommendation: jest.fn(),
    listPending: jest.fn(),
    listHistory: jest.fn(),
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
        DemoAuthGuard,
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects create without demo identity headers', async () => {
    await request(app.getHttpServer())
      .post('/access-requests')
      .send({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: 'DATA_WAREHOUSE',
        entitlementKey: 'prod-postgres-admin',
        justification: 'Need access',
      })
      .expect(401);

    expect(mockHitlService.createWithRecommendation).not.toHaveBeenCalled();
  });

  it('rejects create payloads with empty justification', async () => {
    await request(app.getHttpServer())
      .post('/access-requests')
      .set(userHeaders)
      .send({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: 'DATA_WAREHOUSE',
        entitlementKey: 'prod-postgres-admin',
        justification: '',
      })
      .expect(400);

    expect(mockHitlService.createWithRecommendation).not.toHaveBeenCalled();
  });

  it('creates a request as a user and returns the pending DTO', async () => {
    mockHitlService.createWithRecommendation.mockResolvedValue({
      requestId: 'req-1',
      employeeId: 'E-MOCK-042',
      title: 'Data Analyst',
      department: 'Finance Analytics',
      costCenter: 'CC-FIN-07',
      systemName: 'DATA_WAREHOUSE',
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
      .set(userHeaders)
      .send({
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: 'DATA_WAREHOUSE',
        entitlementKey: 'prod-postgres-admin',
        justification: 'Incident response',
      })
      .expect(201);

    expect(response.body.requestId).toBe('req-1');
    expect(mockHitlService.createWithRecommendation).toHaveBeenCalledWith(
      {
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: 'DATA_WAREHOUSE',
        entitlementKey: 'prod-postgres-admin',
        justification: 'Incident response',
      },
      DEMO_PRINCIPALS.user,
    );
  });

  it('forbids users from listing pending requests', async () => {
    await request(app.getHttpServer()).get('/access-requests/pending').set(userHeaders).expect(403);
    expect(mockHitlService.listPending).not.toHaveBeenCalled();
  });

  it('forbids users from escalating requests', async () => {
    await request(app.getHttpServer())
      .post('/access-requests/req-1/escalate')
      .set(userHeaders)
      .expect(403);

    expect(mockHitlService.escalate).not.toHaveBeenCalled();
  });

  it('escalates via POST /access-requests/:id/escalate as admin', async () => {
    mockHitlService.escalate.mockResolvedValue({
      requestId: 'req-1',
      status: 'escalated',
      provisioningStatus: 'NOT_APPLICABLE',
    });

    const response = await request(app.getHttpServer())
      .post('/access-requests/req-1/escalate')
      .set(adminHeaders)
      .expect(200);

    expect(response.body).toEqual({
      requestId: 'req-1',
      status: 'escalated',
      provisioningStatus: 'NOT_APPLICABLE',
    });
    expect(mockHitlService.escalate).toHaveBeenCalledWith('req-1', DEMO_PRINCIPALS.admin);
  });

  it('lists history for admin', async () => {
    mockHitlService.listHistory.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get('/access-requests/history')
      .set(adminHeaders)
      .expect(200);

    expect(mockHitlService.listHistory).toHaveBeenCalled();
  });
});
