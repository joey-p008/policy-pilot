import { AccessAuditLog } from '@prisma/client';

import { RecommendationSchema } from '../apps/backend/src/modules/ai/schemas/recommendation.schema';
import { ConsoleLlmObservabilityLogger } from '../apps/backend/src/modules/ai/observability/llm-observability.logger';
import type { LlmObservation } from '../apps/backend/src/modules/ai/observability/llm-observability.types';
import { executeWithObservability } from '../apps/backend/src/modules/ai/observability/llm-observability.wrapper';
import { AccessAuditLogRepository } from '../apps/backend/src/modules/database/repositories/access-audit-log.repository';
import { AuditLogService } from '../apps/backend/src/modules/audit-log/audit-log.service';
import { maskPII } from '../shared/pii/mask-pii';

const RAW_EMPLOYEE_ID = 'E1234567';
const RAW_COST_CENTER = 'CC-9001';
const MASKED_EMPLOYEE_ID = 'E1***67';
const MASKED_COST_CENTER = 'CC***01';
const ACTOR_ID = '041aa56a-3752-44ec-a157-436d4f30328f';

function assertNoRawPii(serialized: string): void {
  expect(serialized).not.toContain(RAW_EMPLOYEE_ID);
  expect(serialized).not.toContain(RAW_COST_CENTER);
}

function assertMaskedPiiPresent(serialized: string): void {
  expect(serialized).toContain(MASKED_EMPLOYEE_ID);
  expect(serialized).toContain(MASKED_COST_CENTER);
}

function serializeConsoleArgs(args: unknown[]): string {
  return args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
}

function buildValidRecommendationContent(): string {
  return JSON.stringify({
    decision: 'ESCALATE',
    rationale: 'Policy context is insufficient to approve or deny.',
    policy_citations: [
      {
        document_id: 'pol-1',
        page_number: 2,
        section_title: 'Access Exceptions',
      },
    ],
    confidence_score: 0.25,
  });
}

function buildBaseObservation(overrides: Partial<LlmObservation> = {}): LlmObservation {
  return {
    promptName: 'system-policy',
    promptVersion: '1.3.0',
    model: 'gpt-4o-mini',
    inputPrompt: 'masked prompt body',
    modelResponse: '{}',
    inputTokens: 10,
    outputTokens: 5,
    latencyMs: 12,
    estimatedCostUsd: 0.0001,
    schemaValid: true,
    schemaErrors: [],
    ...overrides,
  };
}

describe('PII audit — mock log outputs and DB insert payloads', () => {
  describe('Case A — mock log outputs', () => {
    let consoleInfoSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    afterEach(() => {
      consoleInfoSpy.mockRestore();
    });

    it('masks nested employee_id and cost_center before ConsoleLlmObservabilityLogger writes', () => {
      const logger = new ConsoleLlmObservabilityLogger();
      const nestedPayload = {
        actor: {
          employee_id: RAW_EMPLOYEE_ID,
          cost_center: RAW_COST_CENTER,
          role: 'requester',
        },
      };
      const alreadyMasked = maskPII(nestedPayload);

      logger.logObservation(
        buildBaseObservation({
          inputPrompt: `Request payload:\n${JSON.stringify(alreadyMasked)}`,
          modelResponse: JSON.stringify({
            decision: 'DENY',
            employee_id: MASKED_EMPLOYEE_ID,
            cost_center: MASKED_COST_CENTER,
          }),
        }),
      );

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const serialized = serializeConsoleArgs(consoleInfoSpy.mock.calls[0] ?? []);
      assertMaskedPiiPresent(serialized);
      assertNoRawPii(serialized);
    });

    it('keeps raw PII out of console.info when executeWithObservability uses ConsoleLlmObservabilityLogger', async () => {
      const logger = new ConsoleLlmObservabilityLogger();

      await executeWithObservability(
        {
          promptKey: 'system-policy',
          model: 'gpt-4o-mini',
          payload: {
            employee_id: RAW_EMPLOYEE_ID,
            cost_center: RAW_COST_CENTER,
            request_id: 'req-pii-audit-1',
          },
          execute: async () => ({
            content: JSON.stringify({
              decision: 'ESCALATE',
              rationale: 'Needs human review.',
              policy_citations: [
                {
                  document_id: 'pol-1',
                  page_number: 1,
                  section_title: 'Overview',
                },
              ],
              confidence_score: 0.4,
              employee_id: RAW_EMPLOYEE_ID,
              cost_center: RAW_COST_CENTER,
            }),
            inputTokens: 100,
            outputTokens: 40,
          }),
        },
        RecommendationSchema,
        logger,
      );

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const serialized = serializeConsoleArgs(consoleInfoSpy.mock.calls[0] ?? []);
      assertMaskedPiiPresent(serialized);
      assertNoRawPii(serialized);
    });
  });

  describe('Case B — mock DB insert payloads', () => {
    it('scrubs employee_id and cost_center before AccessAuditLogRepository.create', async () => {
      const create = jest.fn();
      const repository = { create } as unknown as AccessAuditLogRepository;
      const service = new AuditLogService(repository);

      create.mockResolvedValue({
        id: '82584cee-6bae-40dd-b620-e16c4613e06d',
        requestId: 'req-pii-db',
        actorId: ACTOR_ID,
        action: 'RECOMMENDATION_CREATED',
        previousState: {},
        newState: {},
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      } satisfies AccessAuditLog);

      await service.append({
        requestId: 'req-pii-db',
        actorId: ACTOR_ID,
        action: 'RECOMMENDATION_CREATED',
        previousState: {
          employee_id: RAW_EMPLOYEE_ID,
          status: 'PENDING',
        },
        newState: {
          cost_center: RAW_COST_CENTER,
          status: 'ESCALATED',
        },
      });

      expect(create).toHaveBeenCalledTimes(1);
      const insertPayload = create.mock.calls[0]?.[0] as Record<string, unknown>;
      const serialized = JSON.stringify(insertPayload);

      expect(insertPayload.previousState).toEqual({
        employee_id: MASKED_EMPLOYEE_ID,
        status: 'PENDING',
      });
      expect(insertPayload.newState).toEqual({
        cost_center: MASKED_COST_CENTER,
        status: 'ESCALATED',
      });
      assertMaskedPiiPresent(serialized);
      assertNoRawPii(serialized);
    });
  });

  describe('Case C — nested and array payloads at write boundaries', () => {
    let consoleInfoSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    });

    afterEach(() => {
      consoleInfoSpy.mockRestore();
    });

    it('masks nested and array PII in serialized LLM log lines', async () => {
      const logger = new ConsoleLlmObservabilityLogger();

      await executeWithObservability(
        {
          promptKey: 'rag-synthesis',
          model: 'gpt-4o-mini',
          payload: {
            meta: {
              actor: {
                employee_id: RAW_EMPLOYEE_ID,
                cost_center: RAW_COST_CENTER,
              },
            },
            subjects: [
              { employee_id: RAW_EMPLOYEE_ID, request_id: 'req-a' },
              { cost_center: RAW_COST_CENTER, request_id: 'req-b' },
            ],
          },
          execute: async () => ({
            content: buildValidRecommendationContent(),
            inputTokens: 50,
            outputTokens: 20,
          }),
        },
        RecommendationSchema,
        logger,
      );

      const serialized = serializeConsoleArgs(consoleInfoSpy.mock.calls[0] ?? []);
      assertMaskedPiiPresent(serialized);
      assertNoRawPii(serialized);
    });

    it('masks nested and array PII in audit-log DB insert payloads', async () => {
      const create = jest.fn();
      const repository = { create } as unknown as AccessAuditLogRepository;
      const service = new AuditLogService(repository);

      create.mockResolvedValue({
        id: '82584cee-6bae-40dd-b620-e16c4613e06d',
        requestId: 'req-pii-nested',
        actorId: ACTOR_ID,
        action: 'RECOMMENDATION_CREATED',
        previousState: {},
        newState: {},
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
      } satisfies AccessAuditLog);

      await service.append({
        requestId: 'req-pii-nested',
        actorId: ACTOR_ID,
        action: 'RECOMMENDATION_CREATED',
        previousState: {
          meta: {
            actor: {
              employee_id: RAW_EMPLOYEE_ID,
              role: 'requester',
            },
          },
        },
        newState: {
          subjects: [
            { employee_id: RAW_EMPLOYEE_ID, request_id: 'req-a' },
            { cost_center: RAW_COST_CENTER, request_id: 'req-b' },
          ],
          status: 'PENDING_REVIEW',
        },
      });

      const insertPayload = create.mock.calls[0]?.[0] as {
        previousState: {
          meta: { actor: { employee_id: string; role: string } };
        };
        newState: {
          subjects: Array<Record<string, string>>;
          status: string;
        };
      };
      const serialized = JSON.stringify(insertPayload);

      expect(insertPayload.previousState.meta.actor).toEqual({
        employee_id: MASKED_EMPLOYEE_ID,
        role: 'requester',
      });
      expect(insertPayload.newState.subjects).toEqual([
        { employee_id: MASKED_EMPLOYEE_ID, request_id: 'req-a' },
        { cost_center: MASKED_COST_CENTER, request_id: 'req-b' },
      ]);
      assertMaskedPiiPresent(serialized);
      assertNoRawPii(serialized);
    });
  });
});
