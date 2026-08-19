import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AUTH_PRINCIPALS } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OidcAuthConfig } from '../auth/oidc-auth.config';
import { OidcTokenVerifier } from '../auth/oidc-token.verifier';
import { installOidcTestEnv, signTestAccessToken } from '../../../test/oidc-test-keys';
import { AccessRequestsHitlController } from './access-requests-hitl.controller';
import { HitlAccessRequestsService } from './hitl-access-requests.service';

installOidcTestEnv();

describe('AccessRequestsHitlController', () => {
  let app: INestApplication<App> | undefined;
  let userAuthorization: string;
  let adminAuthorization: string;

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

  beforeAll(async () => {
    userAuthorization = `Bearer ${await signTestAccessToken('user')}`;
    adminAuthorization = `Bearer ${await signTestAccessToken('admin')}`;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccessRequestsHitlController],
      providers: [
        {
          provide: HitlAccessRequestsService,
          useValue: mockHitlService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string): string | undefined => process.env[key],
          },
        },
        OidcAuthConfig,
        OidcTokenVerifier,
        JwtAuthGuard,
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  function httpServer(): App {
    if (app === undefined) {
      throw new Error('Nest application was not initialised');
    }
    return app.getHttpServer();
  }

  it('rejects create without a bearer token', async () => {
    await request(httpServer())
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
    await request(httpServer())
      .post('/access-requests')
      .set('Authorization', userAuthorization)
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
        proposedTool: {
          name: 'propose_access_decision',
          status: 'awaiting_human_approval',
        },
      },
    });

    const response = await request(httpServer())
      .post('/access-requests')
      .set('Authorization', userAuthorization)
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
      AUTH_PRINCIPALS.user,
    );
  });

  it('forbids users from listing pending requests', async () => {
    await request(httpServer())
      .get('/access-requests/pending')
      .set('Authorization', userAuthorization)
      .expect(403);
    expect(mockHitlService.listPending).not.toHaveBeenCalled();
  });

  it('forbids users from escalating requests', async () => {
    await request(httpServer())
      .post('/access-requests/req-1/escalate')
      .set('Authorization', userAuthorization)
      .expect(403);

    expect(mockHitlService.escalate).not.toHaveBeenCalled();
  });

  it('escalates via POST /access-requests/:id/escalate as admin', async () => {
    mockHitlService.escalate.mockResolvedValue({
      requestId: 'req-1',
      status: 'escalated',
      provisioningStatus: 'NOT_APPLICABLE',
    });

    const response = await request(httpServer())
      .post('/access-requests/req-1/escalate')
      .set('Authorization', adminAuthorization)
      .expect(200);

    expect(response.body).toEqual({
      requestId: 'req-1',
      status: 'escalated',
      provisioningStatus: 'NOT_APPLICABLE',
    });
    expect(mockHitlService.escalate).toHaveBeenCalledWith('req-1', AUTH_PRINCIPALS.admin);
  });

  it('lists history for admin', async () => {
    mockHitlService.listHistory.mockResolvedValue([]);

    await request(httpServer())
      .get('/access-requests/history')
      .set('Authorization', adminAuthorization)
      .expect(200);

    expect(mockHitlService.listHistory).toHaveBeenCalled();
  });
});
