import { getQueueToken } from '@nestjs/bullmq';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { z } from 'zod';

import { AppModule } from '../src/app.module';
import { hashIdentifier } from '../src/common/crypto/hash-identifier';
import {
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} from '../src/config/rate-limit.config';
import {
  ACCESS_GRANT_QUEUE,
  buildAccessGrantJobId,
} from '../src/modules/access-requests/access-requests.constants';
import type { EntitlementExecutionInput } from '../src/modules/access-requests/dto/entitlement-execution.dto';
import {
  MockDownstreamRateLimitError,
  MockDownstreamService,
} from '../src/modules/access-requests/mock-downstream.service';
import {
  SEED_HITL_ADMIN_USER_ID,
  SEED_REQUESTOR_EMPLOYEE_ID,
  SEED_REQUESTOR_USER_ID,
} from '../src/modules/access-requests/seed-ids';
import { DecisionEngineService } from '../src/modules/ai/decision-engine.service';
import { RetrievalService } from '../src/modules/ai/retrieval.service';
import {
  DEMO_ACTOR_ID_HEADER,
  DEMO_PRINCIPALS,
  DEMO_ROLE_HEADER,
} from '../src/modules/auth/demo-auth.constants';
import {
  ACCESS_REQUEST_STATUS,
  PROVISIONING_STATUS,
} from '../src/modules/database/repositories/access-request.repository';
import { PrismaService } from '../src/modules/database/prisma.service';

/**
 * Two and a half rate-limit windows of grants, so the queue must throttle
 * rather than pass the whole burst through. Mirrors the production shape where
 * org-wide events arrive at 300/min against a 60/min downstream contract.
 */
const APPROVAL_BURST_SIZE = 150;

const SYSTEM_NAME = 'DATA_WAREHOUSE';
const DRAIN_TIMEOUT_MS = 90_000;
const DRAIN_POLL_INTERVAL_MS = 50;

/** Windows strictly required to clear the burst at the downstream ceiling. */
const REQUIRED_WINDOWS = Math.ceil(APPROVAL_BURST_SIZE / DOWNSTREAM_RATE_LIMIT_MAX);

const decisionResultSchema = z.object({
  requestId: z.string().min(1),
  status: z.literal('approved'),
  provisioningStatus: z.literal(PROVISIONING_STATUS.QUEUED),
});

interface ApproveOutcome {
  requestId: string;
  status: number;
  body: unknown;
}

interface JobOutcome {
  requestId: string;
  found: boolean;
  attemptsMade: number;
}

interface Scenario {
  approvals: ApproveOutcome[];
  jobCounts: Record<string, number>;
  failureReasons: string[];
  grantJobs: JobOutcome[];
  downstreamSuccessTimestamps: number[];
  downstreamRateLimitRejections: number;
  drainDurationMs: number;
  provisionedCount: number;
  queuedCount: number;
  failedProvisioningCount: number;
  entitlementCount: number;
  grantAuditCount: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Highest number of downstream calls observed inside any window-sized span.
 * Anchored on each success so a burst straddling two windows is still caught.
 */
function peakCallsPerWindow(timestamps: number[], windowMs: number): number {
  const ordered = [...timestamps].sort((left, right) => left - right);
  let peak = 0;

  for (let start = 0; start < ordered.length; start += 1) {
    const anchor = ordered[start] as number;
    let count = 0;

    for (let index = start; index < ordered.length; index += 1) {
      if ((ordered[index] as number) - anchor < windowMs) {
        count += 1;
      } else {
        break;
      }
    }

    peak = Math.max(peak, count);
  }

  return peak;
}

describe('Access grant downstream backpressure (integration)', () => {
  const runId = process.env.INTEGRATION_RUN_ID ?? 'grant-local';

  let app: INestApplication<App> | undefined;
  let prisma: PrismaService | undefined;
  let queue: Queue<EntitlementExecutionInput> | undefined;
  let scenario: Scenario;

  const downstreamSuccessTimestamps: number[] = [];
  let downstreamRateLimitRejections = 0;

  const adminHeaders = {
    [DEMO_ROLE_HEADER]: 'admin',
    [DEMO_ACTOR_ID_HEADER]: DEMO_PRINCIPALS.admin.actorId,
  };

  const buildRequestId = (index: number): string => `${runId}-grant-${index}`;

  /**
   * Namespaced per run so the entitlement assertions cannot be perturbed by
   * rows another run (or a developer's local seed) left behind.
   */
  const entitlementKeyPrefix = `${runId}-FIN_DATASET_READ-`;
  const buildEntitlementKey = (index: number): string => `${entitlementKeyPrefix}${index}`;

  async function approve(requestId: string): Promise<ApproveOutcome> {
    if (app === undefined) {
      throw new Error('Nest application was not initialised');
    }

    const response = await request(app.getHttpServer())
      .post(`/access-requests/${requestId}/approve`)
      .set(adminHeaders);

    return { requestId, status: response.status, body: response.body };
  }

  async function waitForDrain(
    activeQueue: Queue<EntitlementExecutionInput>,
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
          `Grant queue did not drain within ${DRAIN_TIMEOUT_MS}ms: ${JSON.stringify(counts)}`,
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
      .useValue({ retrieve: jest.fn().mockResolvedValue([]) })
      .overrideProvider(DecisionEngineService)
      .useValue({
        decide: jest.fn().mockResolvedValue({
          decision: 'APPROVE',
          rationale: 'Grant backpressure integration stub recommendation.',
          confidence_score: 0.9,
          policy_citations: [],
        }),
      })
      .compile();

    const activeApp = moduleRef.createNestApplication<INestApplication<App>>();
    await activeApp.init();
    await activeApp.listen(0);

    const activePrisma = activeApp.get(PrismaService);
    const activeQueue = activeApp.get<Queue<EntitlementExecutionInput>>(
      getQueueToken(ACCESS_GRANT_QUEUE),
    );

    app = activeApp;
    prisma = activePrisma;
    queue = activeQueue;

    await activePrisma.idempotencyKey.deleteMany({ where: { requestId: { contains: runId } } });
    await activePrisma.accessAuditLog.deleteMany({ where: { requestId: { contains: runId } } });
    await activePrisma.accessRequest.deleteMany({ where: { requestId: { contains: runId } } });

    await activePrisma.user.upsert({
      where: { id: SEED_REQUESTOR_USER_ID },
      create: {
        id: SEED_REQUESTOR_USER_ID,
        employeeIdHash: hashIdentifier(SEED_REQUESTOR_EMPLOYEE_ID),
        department: 'Engineering',
        costCenterHash: 'd02c81895847a0671a5ad9621989da8ec6ef82174e0ab2b20936a8648b40ec55',
        role: 'engineer',
      },
      update: { employeeIdHash: hashIdentifier(SEED_REQUESTOR_EMPLOYEE_ID) },
    });
    await activePrisma.user.upsert({
      where: { id: SEED_HITL_ADMIN_USER_ID },
      create: {
        id: SEED_HITL_ADMIN_USER_ID,
        employeeIdHash: 'a11a1111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        department: 'Security',
        costCenterHash: '4905fe7b8ad9cf74ee9f1dc5c66c6cd5cb0e66b3f53a099a277e9e681d1ec87c',
        role: 'hitl_admin',
      },
      update: {},
    });

    // Seeded directly so the burst measures the grant path rather than the
    // recommendation pipeline that precedes it.
    await activePrisma.accessRequest.createMany({
      data: Array.from({ length: APPROVAL_BURST_SIZE }, (_unused, index) => ({
        requestId: buildRequestId(index),
        employeeId: SEED_REQUESTOR_EMPLOYEE_ID,
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        systemName: SYSTEM_NAME,
        targetEntitlement: buildEntitlementKey(index),
        justification: 'Quarterly reporting pipeline',
        status: ACCESS_REQUEST_STATUS.PENDING_REVIEW,
        provisioningStatus: PROVISIONING_STATUS.NOT_APPLICABLE,
        recommendationJson: {
          decision: 'APPROVE',
          rationale: 'Read-scoped access is within policy.',
          confidenceScore: 0.9,
          policyCitations: [],
        },
      })),
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

      downstreamSuccessTimestamps.push(Date.now());
    });

    const startedAt = Date.now();

    const approvals = await Promise.all(
      Array.from({ length: APPROVAL_BURST_SIZE }, (_unused, index) =>
        approve(buildRequestId(index)),
      ),
    );

    const jobCounts = await waitForDrain(activeQueue, APPROVAL_BURST_SIZE);
    const drainDurationMs = Date.now() - startedAt;

    const grantJobs = await Promise.all(
      Array.from({ length: APPROVAL_BURST_SIZE }, async (_unused, index) => {
        const requestId = buildRequestId(index);
        const job = await activeQueue.getJob(buildAccessGrantJobId(requestId));

        return {
          requestId,
          found: job !== undefined,
          attemptsMade: job?.attemptsMade ?? 0,
        } satisfies JobOutcome;
      }),
    );

    const failedJobs = await activeQueue.getFailed();

    scenario = {
      approvals,
      jobCounts,
      failureReasons: failedJobs.map(
        (job) => `${job.id ?? 'unknown'}: ${job.failedReason ?? 'unknown reason'}`,
      ),
      grantJobs,
      downstreamSuccessTimestamps: [...downstreamSuccessTimestamps],
      downstreamRateLimitRejections,
      drainDurationMs,
      provisionedCount: await activePrisma.accessRequest.count({
        where: {
          requestId: { contains: runId },
          provisioningStatus: PROVISIONING_STATUS.PROVISIONED,
        },
      }),
      queuedCount: await activePrisma.accessRequest.count({
        where: { requestId: { contains: runId }, provisioningStatus: PROVISIONING_STATUS.QUEUED },
      }),
      failedProvisioningCount: await activePrisma.accessRequest.count({
        where: { requestId: { contains: runId }, provisioningStatus: PROVISIONING_STATUS.FAILED },
      }),
      entitlementCount: await activePrisma.entitlement.count({
        where: {
          userId: SEED_REQUESTOR_USER_ID,
          resourceName: SYSTEM_NAME,
          permissionLevel: { startsWith: entitlementKeyPrefix },
        },
      }),
      grantAuditCount: await activePrisma.accessAuditLog.count({
        where: { requestId: { contains: runId }, action: 'ACCESS_GRANTED' },
      }),
    };
  });

  afterAll(async () => {
    try {
      if (prisma !== undefined) {
        await prisma.idempotencyKey.deleteMany({ where: { requestId: { contains: runId } } });
        await prisma.accessAuditLog.deleteMany({ where: { requestId: { contains: runId } } });
        await prisma.accessRequest.deleteMany({ where: { requestId: { contains: runId } } });
        await prisma.entitlement.deleteMany({
          where: {
            userId: SEED_REQUESTOR_USER_ID,
            resourceName: SYSTEM_NAME,
            permissionLevel: { startsWith: entitlementKeyPrefix },
          },
        });
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

  describe('requirement 1: a burst of approvals is accepted without downstream errors', () => {
    it('answers every approve with HTTP 200', () => {
      expect(scenario.approvals).toHaveLength(APPROVAL_BURST_SIZE);
      expect(scenario.approvals.filter((outcome) => outcome.status !== 200)).toEqual([]);
    });

    it('never leaks a rate-limit failure to the HTTP caller', () => {
      expect(scenario.approvals.filter((outcome) => outcome.status >= 500)).toEqual([]);
    });

    it('reports each approval as queued for asynchronous provisioning', () => {
      const parsed = scenario.approvals.map((outcome) => decisionResultSchema.parse(outcome.body));

      expect(parsed).toHaveLength(APPROVAL_BURST_SIZE);
      expect(new Set(parsed.map((body) => body.requestId)).size).toBe(APPROVAL_BURST_SIZE);
    });
  });

  describe('requirement 2: the queue holds the downstream to its 60/min contract', () => {
    it('never exceeds the downstream ceiling within any single window', () => {
      expect(
        peakCallsPerWindow(scenario.downstreamSuccessTimestamps, DOWNSTREAM_RATE_LIMIT_WINDOW_MS),
      ).toBeLessThanOrEqual(DOWNSTREAM_RATE_LIMIT_MAX);
    });

    it('actually exercises backpressure rather than sailing under the limit', () => {
      expect(scenario.downstreamRateLimitRejections).toBeGreaterThan(0);
    });

    it('paces the burst across the windows the contract requires', () => {
      const minimumDrainMs = (REQUIRED_WINDOWS - 1) * DOWNSTREAM_RATE_LIMIT_WINDOW_MS;

      expect(scenario.drainDurationMs).toBeGreaterThanOrEqual(minimumDrainMs);
    });
  });

  describe('requirement 3: backpressure costs throughput, not retries', () => {
    it('settles every grant without a failed job', () => {
      expect(scenario.failureReasons).toEqual([]);
      expect(scenario.jobCounts.failed).toBe(0);
      expect(scenario.jobCounts.completed).toBe(APPROVAL_BURST_SIZE);
    });

    it('spends no retry attempt on a rate-limited grant', () => {
      expect(scenario.grantJobs.filter((job) => !job.found)).toEqual([]);
      // A requeue driven by RateLimitError must not count as a retry, so every
      // grant should show at most the single attempt that finally succeeded.
      expect(scenario.grantJobs.filter((job) => job.attemptsMade > 1)).toEqual([]);
    });
  });

  describe('requirement 4: every approved request ends up provisioned exactly once', () => {
    it('invokes the downstream once per approval', () => {
      expect(scenario.downstreamSuccessTimestamps).toHaveLength(APPROVAL_BURST_SIZE);
    });

    it('marks all requests PROVISIONED and none left QUEUED or FAILED', () => {
      expect(scenario.provisionedCount).toBe(APPROVAL_BURST_SIZE);
      expect(scenario.queuedCount).toBe(0);
      expect(scenario.failedProvisioningCount).toBe(0);
    });

    it('persists one entitlement and one audit row per grant', () => {
      expect(scenario.entitlementCount).toBe(APPROVAL_BURST_SIZE);
      expect(scenario.grantAuditCount).toBe(APPROVAL_BURST_SIZE);
    });
  });
});
