import { InternalServerErrorException } from '@nestjs/common';

import type { ChatClient } from './chat/chat.types';
import { DecisionEngineService } from './decision-engine.service';
import { DecisionSchema } from './schemas/recommendation.schema';
import { PROPOSE_ACCESS_DECISION_TOOL_NAME } from './tools/propose-access-decision.tool';

describe('DecisionEngineService', () => {
  const validDecision = {
    decision: 'DENY' as const,
    rationale: 'Policy forbids production admin without a change ticket.',
    policy_citations: [
      {
        document_id: 'POL-2026-02',
        page_number: 4,
        section_title: 'Privileged Access',
      },
    ],
    confidence_score: 0.91,
  };

  const policyChunks = [
    {
      document_id: 'POL-2026-02',
      page_number: 4,
      section_title: 'Privileged Access',
      content: 'Production admin requires an approved change ticket.',
    },
  ];

  const mockChatClient: jest.Mocked<ChatClient> = {
    model: 'gpt-4o-mini',
    complete: jest.fn(),
  };

  let service: DecisionEngineService;

  function mockToolCompletion(payload: unknown, tokens = { input: 120, output: 80 }) {
    const argumentsJson = JSON.stringify(payload);
    mockChatClient.complete.mockResolvedValue({
      content: argumentsJson,
      toolCalls: [
        {
          id: 'call_test',
          name: PROPOSE_ACCESS_DECISION_TOOL_NAME,
          argumentsJson,
        },
      ],
      inputTokens: tokens.input,
      outputTokens: tokens.output,
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DecisionEngineService(mockChatClient);
  });

  it('constructs with only the chat client (HITL isolation — no mutation deps)', () => {
    expect(service).toBeInstanceOf(DecisionEngineService);
    expect(Object.getOwnPropertyNames(service)).not.toContain('policyChunkRepository');
    expect(Object.getOwnPropertyNames(service)).not.toContain('prisma');
    expect(Object.getOwnPropertyNames(service)).not.toContain('entitlementExecutionService');
  });

  it('returns a DecisionSchema-valid object for a valid propose_access_decision tool call', async () => {
    mockToolCompletion(validDecision);

    const decision = await service.decide({
      request: {
        requestId: 'req-42',
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Emergency production incident response',
      },
      policyChunks,
    });

    expect(DecisionSchema.parse(decision)).toEqual(validDecision);
    expect(mockChatClient.complete).toHaveBeenCalledTimes(1);
    const assembledPrompt = mockChatClient.complete.mock.calls[0]?.[0] ?? '';
    expect(assembledPrompt).toContain('prod-postgres-admin');
    expect(assembledPrompt).toContain('Emergency production incident response');
    expect(assembledPrompt).not.toContain('employeeId');
    expect(mockChatClient.complete.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        toolChoice: { name: PROPOSE_ACCESS_DECISION_TOOL_NAME },
        tools: [
          expect.objectContaining({
            name: PROPOSE_ACCESS_DECISION_TOOL_NAME,
            requiresHumanApproval: true,
            strict: true,
          }),
        ],
      }),
    );
    expect(mockChatClient.complete.mock.calls[0]?.[1]?.jsonSchema).toBeUndefined();
  });

  it('includes structured access-request context in the LLM payload', async () => {
    mockToolCompletion(validDecision);

    await service.decide({
      request: {
        requestId: 'req-42',
        targetEntitlement: 'FIN_BILLING_EXPORT',
        justification: 'Need billing export for close',
        title: 'Data Analyst',
        department: 'Finance Analytics',
        costCenter: 'CC-FIN-07',
        targetResource: 'DATA_WAREHOUSE / FIN_DATASET',
        currentEntitlements: ['FIN_DATASET_EDIT'],
      },
      policyChunks,
    });

    const assembledPrompt = mockChatClient.complete.mock.calls[0]?.[0] ?? '';
    expect(assembledPrompt).toContain('CC-FIN-07');
    expect(assembledPrompt).toContain('FIN_DATASET_EDIT');
    expect(assembledPrompt).toContain('Finance Analytics');
    expect(assembledPrompt).toContain('Data Analyst');
  });

  it('forces ESCALATE when APPROVE citations cannot be grounded in retrieved chunks', async () => {
    mockToolCompletion({
      decision: 'APPROVE',
      rationale: 'Baseline match claimed without retrieved support.',
      policy_citations: [
        {
          document_id: 'POL-9999-99-ZZZ',
          page_number: 1,
          section_title: 'Invented Section',
        },
      ],
      confidence_score: 0.99,
    });

    const decision = await service.decide({
      request: {
        requestId: 'req-ungrounded',
        targetEntitlement: 'prod-postgres-admin',
        justification: 'Need admin for deploy',
      },
      policyChunks,
    });

    expect(decision.decision).toBe('ESCALATE');
    expect(decision.policy_citations).toEqual([]);
    expect(decision.confidence_score).toBeLessThanOrEqual(0.39);
  });

  it('throws InternalServerErrorException when LLM returns unformatted text', async () => {
    mockChatClient.complete.mockResolvedValue({
      content: 'I think we should approve this.',
      toolCalls: [],
      inputTokens: 10,
      outputTokens: 8,
    });

    await expect(
      service.decide({
        request: {
          requestId: 'req-43',
          targetEntitlement: 'prod-postgres-admin',
          justification: 'Need admin for deploy',
        },
        policyChunks,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('throws InternalServerErrorException when LLM returns unauthorized SQL text', async () => {
    mockChatClient.complete.mockResolvedValue({
      content: 'DROP TABLE users; --',
      toolCalls: [],
      inputTokens: 10,
      outputTokens: 8,
    });

    await expect(
      service.decide({
        request: {
          requestId: 'req-44',
          targetEntitlement: 'prod-postgres-admin',
          justification: 'Need admin for deploy',
        },
        policyChunks,
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
