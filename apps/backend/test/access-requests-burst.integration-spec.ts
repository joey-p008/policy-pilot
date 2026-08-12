import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { DecisionEngineService } from '../src/modules/ai/decision-engine.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import {
  ACCESS_REQUEST_JOB_ATTEMPTS,
  ACCESS_REQUEST_JOB_NAME,
  ACCESS_REQUEST_QUEUE,
  ACCESS_REQUEST_WORKER_ENDPOINT,
  ACCESS_REQUESTS_WEBHOOK_ENDPOINT,
  buildWorkerIdempotencyRequestId,
} from '../src/modules/access-requests/access-requests.constants';
import { AccessRequestDto } from '../src/modules/access-requests/dto/access-requests.dto';
import { SEED_SYSTEM_INGEST_USER_ID } from '../src/modules/access-requests/seed-ids';
import {
  MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE,
  MockDownstreamRateLimitError,
  MockDownstreamService,
} from '../src/modules/access-requests/mock-downstream.service';
import { PrismaService } from '../src/modules/database/prisma.service';

const BURST_SIZE = 100;
const DUPLICATE_REPLAY_COUNT = 25;
const CONCURRENT_SAME_ID_COUNT = 10;
const DRAIN_TIMEOUT_MS = 60_000;
const DRAIN_POLL_INTERVAL_MS = 50;

/** 100 unique webhooks plus the single shared-id request from the race probe. */
const EXPECTED_UNIQUE_REQUESTS = BURST_SIZE + 1;

/** Every unique request, plus the redelivered job that must be intercepted. */
const EXPECTED_COMPLETED_JOBS = EXPECTED_UNIQUE_REQUESTS + 1;

const acceptedResponseSchema = z.object({
  replayed: z.boolean(),
  response: z.object({
    status: z.literal('accepted'),
    requestId: z.string().min(1),
    statusUrl: z.string().regex(/^\/access-requests\/[^/]+\/status$/),
  }),
});

const workerResultSchema = z.object({
  replayed: z.boolean(),
  response: z.object({
    status: z.literal('processed'),
    requestId: z.string().min(1),
  }),
});

type AcceptedResponse = z.infer<typeof acceptedResponseSchema>;

interface WebhookOutcome {
  requestId: string;
  status: number;
  body: unknown;
}

interface JobOutcome {
  requestId: string;
  found: boolean;
  attemptsMade: number;
  returnValue: unknown;
}

interface Scenario {
  burst: WebhookOutcome[];
  sameIdRace: WebhookOutcome[];
  duplicateReplays: WebhookOutcome[];
  burstJobs: JobOutcome[];
  redelivery: JobOutcome;
  jobCounts: Record<string, number>;
  failureReasons: string[];
  downstreamSuccessesBeforeRedelivery: number;
  downstreamSuccessesAfterRedelivery: number;
  downstreamRateLimitRejections: number;
  webhookKeyCount: number;
  workerKeyCount: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseAccepted(outcome: WebhookOutcome): AcceptedResponse {
  return acceptedResponseSchema.parse(outcome.body);
}

describe('Access request webhook burst ingestion (integration)', () => {
  const runId = process.env.INTEGRATION_RUN_ID ?? 'burst-local';

  let app: INestApplication<App> | undefined;
  let prisma: PrismaService | undefined;
  let queue: Queue<AccessRequestDto> | undefined;
  let scenario: Scenario;

  let downstreamSuccesses = 0;
  let downstreamRateLimitRejections = 0;

  const buildRequestId = (index: number): string => `${runId}-req-${index}`;
  const sameIdRequestId = `${runId}-race`;
  const redeliveryJobId = `${runId}-redelivery`;

  const buildDto = (requestId: string): AccessRequestDto => ({
    request_id: requestId,
    employee_id: `emp-${requestId}`,
    request_type: 'GRANT_ENTITLEMENT',
    timestamp: '2026-07-01T09:15:00Z',
    requester: {
      title: 'Data Analyst',
      department: 'Finance Analytics',
      cost_center: 'CC-FIN-07',
    },
    target: {
      system_name: 'DATA_WAREHOUSE',
      entitlement_key: 'FIN_DATASET_EDIT',
      justification: 'Need to build quarterly revenue models.',
    },
  });

  async function postWebhook(dto: AccessRequestDto): Promise<WebhookOutcome> {
    if (app === undefined) {
      throw new Error('Nest application was not initialised');
    }

    const response = await request(app.getHttpServer())
      .post(ACCESS_REQUESTS_WEBHOOK_ENDPOINT)
      .send(dto);

    return {
      requestId: dto.request_id,
      status: response.status,
      body: response.body,
    };
  }

  async function readJobOutcome(
    activeQueue: Queue<AccessRequestDto>,
    jobId: string,
    requestId: string,
  ): Promise<JobOutcome> {
    const job = await activeQueue.getJob(jobId);

    if (job === undefined) {
      return { requestId, found: false, attemptsMade: 0, returnValue: undefined };
    }

    return {
      requestId,
      found: true,
      attemptsMade: job.attemptsMade,
      returnValue: job.returnvalue,
    };
  }

  async function waitForDrain(
    activeQueue: Queue<AccessRequestDto>,
    expectedSettled: number,
  ): Promise<Record<string, number>> {
    const deadline = Date.now() + DRAIN_TIMEOUT_MS;

    for (;;) {
      const counts = await activeQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'prioritized',
        'waiting-children',
        'completed',
        'failed',
      );

      const outstanding =
        counts.waiting +
        counts.active +
        counts.delayed +
        counts.prioritized +
        counts['waiting-children'];
      const settled = counts.completed + counts.failed;

      if (outstanding === 0 && settled >= expectedSettled) {
        return counts;
      }

      if (Date.now() >= deadline) {
        throw new Error(
          `Queue did not drain within ${DRAIN_TIMEOUT_MS}ms: ${JSON.stringify(counts)}`,
        );
      }

      await delay(DRAIN_POLL_INTERVAL_MS);
    }
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RetrievalService)
      .useValue({
        retrieve: jest.fn().mockResolvedValue([]),
      })
      .overrideProvider(DecisionEngineService)
      .useValue({
        decide: jest.fn().mockResolvedValue({
          decision: 'ESCALATE',
          rationale: 'Burst integration stub recommendation.',
          confidence_score: 0.2,
          policy_citations: [],
        }),
      })
      .compile();

    const activeApp = moduleRef.createNestApplication<INestApplication<App>>();
    await activeApp.init();
    await activeApp.listen(0);

    const activePrisma = activeApp.get(PrismaService);
    const activeQueue = activeApp.get<Queue<AccessRequestDto>>(getQueueToken(ACCESS_REQUEST_QUEUE));

    app = activeApp;
    prisma = activePrisma;
    queue = activeQueue;

    await activePrisma.idempotencyKey.deleteMany({ where: { requestId: { contains: runId } } });
    await activePrisma.accessAuditLog.deleteMany({ where: { requestId: { contains: runId } } });
    await activePrisma.accessRequest.deleteMany({ where: { requestId: { contains: runId } } });
    await activePrisma.user.upsert({
      where: { id: SEED_SYSTEM_INGEST_USER_ID },
      create: {
        id: SEED_SYSTEM_INGEST_USER_ID,
        employeeIdHash: 'b22b2222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        department: 'Platform',
        costCenterHash: 'd02c81895847a0671a5ad9621989da8ec6ef82174e0ab2b20936a8648b40ec55',
        role: 'system_ingest',
      },
      update: {},
    });

    const downstream = activeApp.get(MockDownstreamService);
    const realInvoke = downstream.invoke.bind(downstream);

    jest.spyOn(downstream, 'invoke').mockImplementation(async (): Promise<void> => {
      try {
        await realInvoke();
      } catch (error: unknown) {
        if (error instanceof MockDownstreamRateLimitError) {
          downstreamRateLimitRejections += 1;
        }

        throw error;
      }

      downstreamSuccesses += 1;
    });

    const burst = await Promise.all(
      Array.from({ length: BURST_SIZE }, (_unused, index) =>
        postWebhook(buildDto(buildRequestId(index))),
      ),
    );

    const sameIdRace = await Promise.all(
      Array.from({ length: CONCURRENT_SAME_ID_COUNT }, () =>
        postWebhook(buildDto(sameIdRequestId)),
      ),
    );

    const duplicateReplays = await Promise.all(
      Array.from({ length: DUPLICATE_REPLAY_COUNT }, (_unused, index) =>
        postWebhook(buildDto(buildRequestId(index))),
      ),
    );

    await waitForDrain(activeQueue, EXPECTED_UNIQUE_REQUESTS);

    const burstJobs = await Promise.all(
      Array.from({ length: BURST_SIZE }, (_unused, index) => {
        const requestId = buildRequestId(index);
        return readJobOutcome(activeQueue, requestId, requestId);
      }),
    );

    const downstreamSuccessesBeforeRedelivery = downstreamSuccesses;

    // Simulates a queue redelivery: a fresh job id carrying an already-processed
    // requestId, which only the worker-scoped idempotency key can intercept.
    await activeQueue.add(ACCESS_REQUEST_JOB_NAME, buildDto(buildRequestId(0)), {
      jobId: redeliveryJobId,
    });

    const jobCounts = await waitForDrain(activeQueue, EXPECTED_COMPLETED_JOBS);
    const redelivery = await readJobOutcome(activeQueue, redeliveryJobId, buildRequestId(0));

    const failedJobs = await activeQueue.getFailed();

    scenario = {
      burst,
      sameIdRace,
      duplicateReplays,
      burstJobs,
      redelivery,
      jobCounts,
      failureReasons: failedJobs.map(
        (job) => `${job.id ?? 'unknown'}: ${job.failedReason ?? 'unknown reason'}`,
      ),
      downstreamSuccessesBeforeRedelivery,
      downstreamSuccessesAfterRedelivery: downstreamSuccesses,
      downstreamRateLimitRejections,
      webhookKeyCount: await activePrisma.idempotencyKey.count({
        where: {
          endpoint: ACCESS_REQUESTS_WEBHOOK_ENDPOINT,
          requestId: { contains: runId },
        },
      }),
      workerKeyCount: await activePrisma.idempotencyKey.count({
        where: {
          endpoint: ACCESS_REQUEST_WORKER_ENDPOINT,
          requestId: { contains: runId },
        },
      }),
    };
  });

  afterAll(async () => {
    try {
      if (prisma !== undefined) {
        await prisma.idempotencyKey.deleteMany({ where: { requestId: { contains: runId } } });
        await prisma.accessAuditLog.deleteMany({ where: { requestId: { contains: runId } } });
        await prisma.accessRequest.deleteMany({ where: { requestId: { contains: runId } } });
      }

      if (queue !== undefined) {
        await queue.obliterate({ force: true });
      }
    } finally {
      if (app !== undefined) {
        await app.close();
      }
    }
  });

  describe('requirement 1: 100 concurrent webhooks are all accepted', () => {
    it('answers every request with HTTP 202 Accepted', () => {
      expect(scenario.burst).toHaveLength(BURST_SIZE);
      expect(scenario.burst.filter((outcome) => outcome.status !== 202)).toEqual([]);
    });

    it('drops no request and enqueues each one exactly once', () => {
      const accepted = scenario.burst.map(parseAccepted);
      const acknowledgedIds = accepted.map((body) => body.response.requestId);

      expect(new Set(acknowledgedIds).size).toBe(BURST_SIZE);
      expect(accepted.every((body) => body.replayed === false)).toBe(true);
      expect(scenario.burstJobs.filter((job) => !job.found)).toEqual([]);
    });
  });

  describe('requirement 2: exponential backoff absorbs downstream rate limiting', () => {
    it('permanently fails no job despite bursting past the downstream ceiling', () => {
      expect(BURST_SIZE).toBeGreaterThan(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);
      expect(scenario.failureReasons).toEqual([]);
      expect(scenario.jobCounts.failed).toBe(0);
      expect(scenario.jobCounts.completed).toBe(EXPECTED_COMPLETED_JOBS);
    });

    it('actually drives the downstream into rate limiting', () => {
      expect(scenario.downstreamRateLimitRejections).toBeGreaterThan(0);
      expect(scenario.burstJobs.filter((job) => job.attemptsMade > 1).length).toBeGreaterThan(0);
    });

    it('recovers every rate-limited job inside its retry budget', () => {
      const exhausted = scenario.burstJobs.filter(
        (job) => job.attemptsMade > ACCESS_REQUEST_JOB_ATTEMPTS,
      );

      expect(exhausted).toEqual([]);
      expect(scenario.downstreamRateLimitRejections).toBeLessThanOrEqual(
        EXPECTED_UNIQUE_REQUESTS * (ACCESS_REQUEST_JOB_ATTEMPTS - 1),
      );
    });

    it('invokes the downstream exactly once per unique request', () => {
      expect(scenario.downstreamSuccessesBeforeRedelivery).toBe(EXPECTED_UNIQUE_REQUESTS);

      const processedOnce = scenario.burstJobs.map((job) =>
        workerResultSchema.parse(job.returnValue),
      );

      expect(processedOnce.every((result) => result.replayed === false)).toBe(true);
    });
  });

  describe('requirement 3: the idempotency table intercepts duplicate webhook ids', () => {
    it('replays a repeated webhook id without re-enqueuing it', () => {
      const replays = scenario.duplicateReplays.map(parseAccepted);

      expect(scenario.duplicateReplays.filter((outcome) => outcome.status !== 202)).toEqual([]);
      expect(replays.every((body) => body.replayed === true)).toBe(true);
    });

    it('returns the originally stored payload byte-for-byte on replay', () => {
      const originals = new Map(
        scenario.burst.map((outcome) => [outcome.requestId, parseAccepted(outcome).response]),
      );

      for (const outcome of scenario.duplicateReplays) {
        expect(parseAccepted(outcome).response).toEqual(originals.get(outcome.requestId));
      }
    });

    it('lets exactly one writer win a concurrent race on the same request id', () => {
      const raced = scenario.sameIdRace.map(parseAccepted);

      expect(scenario.sameIdRace.filter((outcome) => outcome.status !== 202)).toEqual([]);
      expect(raced.filter((body) => body.replayed === false)).toHaveLength(1);
      expect(raced.filter((body) => body.replayed === true)).toHaveLength(
        CONCURRENT_SAME_ID_COUNT - 1,
      );
    });

    it('intercepts a redelivered job before it reaches the downstream twice', () => {
      expect(scenario.redelivery.found).toBe(true);
      expect(workerResultSchema.parse(scenario.redelivery.returnValue)).toEqual({
        replayed: true,
        response: {
          status: 'processed',
          requestId: buildRequestId(0),
        },
      });
      expect(scenario.downstreamSuccessesAfterRedelivery).toBe(
        scenario.downstreamSuccessesBeforeRedelivery,
      );
    });

    it('persists one idempotency key per unique request at both boundaries', () => {
      expect(scenario.webhookKeyCount).toBe(EXPECTED_UNIQUE_REQUESTS);
      expect(scenario.workerKeyCount).toBe(EXPECTED_UNIQUE_REQUESTS);
    });

    it('namespaces the worker key so it cannot collide with the webhook key', () => {
      expect(buildWorkerIdempotencyRequestId(buildRequestId(0))).not.toBe(buildRequestId(0));
    });
  });
});
