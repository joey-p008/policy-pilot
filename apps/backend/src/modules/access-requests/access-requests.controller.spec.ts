import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AccessRequestsController } from './access-requests.controller';
import { AccessRequestHandleResult, AccessRequestsService } from './access-requests.service';

describe('AccessRequestsController', () => {
  let app: INestApplication<App>;
  const handleIncoming = jest.fn<
    Promise<AccessRequestHandleResult>,
    Parameters<AccessRequestsService['handleIncoming']>
  >();

  beforeEach(async () => {
    handleIncoming.mockReset();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AccessRequestsController],
      providers: [
        {
          provide: AccessRequestsService,
          useValue: {
            handleIncoming,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 202 Accepted with a status polling URI after queue dispatch', async () => {
    const accepted: AccessRequestHandleResult = {
      replayed: false,
      response: {
        status: 'accepted',
        requestId: 'req-100',
        statusUrl: '/access-requests/req-100/status',
      },
    };
    handleIncoming.mockResolvedValue(accepted);

    const response = await request(app.getHttpServer())
      .post('/webhooks/access-requests')
      .send({
        requestId: 'req-100',
        employeeId: 'emp-42',
        targetEntitlement: 'vpn-access',
      })
      .expect(202);

    expect(response.body).toEqual(accepted);
    expect(response.body.response.statusUrl).toMatch(/^\/access-requests\/[^/]+\/status$/);
    expect(handleIncoming).toHaveBeenCalledTimes(1);
    expect(handleIncoming).toHaveBeenCalledWith({
      requestId: 'req-100',
      employeeId: 'emp-42',
      targetEntitlement: 'vpn-access',
    });
  });

  it('rejects a malformed payload with 400 Bad Request', async () => {
    const response = await request(app.getHttpServer())
      .post('/webhooks/access-requests')
      .send({
        requestId: '',
        employeeId: 'emp-42',
        targetEntitlement: 'vpn-access',
      })
      .expect(400);

    expect(response.body).toEqual(
      expect.objectContaining({
        message: 'Validation failed',
        errors: expect.objectContaining({
          fieldErrors: expect.objectContaining({
            requestId: expect.arrayContaining([expect.any(String)]),
          }),
        }),
      }),
    );
    expect(handleIncoming).not.toHaveBeenCalled();
  });

  it('rejects a payload missing required fields with 400 Bad Request', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/access-requests')
      .send({
        employeeId: 'emp-42',
      })
      .expect(400);

    expect(handleIncoming).not.toHaveBeenCalled();
  });
});
