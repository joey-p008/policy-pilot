import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { CHAT_CLIENT, type ChatClient } from './chat/chat.types';
import { groundDecisionCitations } from './citation-grounding';
import { PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';
import { executeWithObservability } from './observability/llm-observability.wrapper';
import { ACCESS_DECISION_PROMPT_KEY } from './prompts/access-decision.prompt';
import { Decision, DecisionSchema } from './schemas/recommendation.schema';
import {
  PROPOSE_ACCESS_DECISION_TOOL,
  PROPOSE_ACCESS_DECISION_TOOL_NAME,
} from './tools/propose-access-decision.tool';

const DecisionEngineRequestSchema = z.object({
  requestId: z.string().min(1),
  targetEntitlement: z.string().min(1),
  justification: z.string().min(1),
  title: z.string().min(1).optional(),
  costCenter: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
  targetResource: z.string().min(1).optional(),
  currentEntitlements: z.array(z.string()).optional(),
});

const DecisionEngineInputSchema = z.object({
  request: DecisionEngineRequestSchema,
  policyChunks: z.array(PolicyDocumentChunkSchema),
});

export type DecisionEngineInput = z.infer<typeof DecisionEngineInputSchema>;

@Injectable()
export class DecisionEngineService {
  public constructor(@Inject(CHAT_CLIENT) private readonly chatClient: ChatClient) {}

  public async decide(input: DecisionEngineInput): Promise<Decision> {
    const validated = DecisionEngineInputSchema.parse(input);

    const payload = {
      access_request: {
        request_id: validated.request.requestId,
        target_entitlement: validated.request.targetEntitlement,
        entitlement_key: validated.request.targetEntitlement,
        justification: validated.request.justification,
        ...(validated.request.title !== undefined ? { title: validated.request.title } : {}),
        ...(validated.request.department !== undefined
          ? { department: validated.request.department }
          : {}),
        ...(validated.request.costCenter !== undefined
          ? { cost_center: validated.request.costCenter }
          : {}),
        ...(validated.request.targetResource !== undefined
          ? {
              target_resource: validated.request.targetResource,
              system_name: validated.request.targetResource,
            }
          : {}),
        ...(validated.request.currentEntitlements !== undefined
          ? { current_entitlements: validated.request.currentEntitlements }
          : {}),
      },
      policy_chunks: validated.policyChunks,
    };

    const result = await executeWithObservability(
      {
        promptKey: ACCESS_DECISION_PROMPT_KEY,
        model: this.chatClient.model,
        payload,
        expectedToolName: PROPOSE_ACCESS_DECISION_TOOL_NAME,
        execute: (assembledPrompt: string) =>
          this.chatClient.complete(assembledPrompt, {
            tools: [PROPOSE_ACCESS_DECISION_TOOL],
            toolChoice: { name: PROPOSE_ACCESS_DECISION_TOOL_NAME },
          }),
      },
      DecisionSchema,
    );

    if (result.data === null || !result.observation.schemaValid) {
      throw new InternalServerErrorException('Internal server error');
    }

    return groundDecisionCitations(result.data, validated.policyChunks);
  }
}
