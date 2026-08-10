import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { z } from 'zod';

import { CHAT_CLIENT, type ChatClient } from './chat/chat.types';
import { PolicyDocumentChunkSchema } from './dto/document-ingestion.dto';
import { executeWithObservability } from './observability/llm-observability.wrapper';
import { ACCESS_DECISION_PROMPT_KEY } from './prompts/access-decision.prompt';
import { Decision, DecisionSchema } from './schemas/recommendation.schema';

const DecisionEngineRequestSchema = z.object({
  requestId: z.string().min(1),
  targetEntitlement: z.string().min(1),
  justification: z.string().min(1),
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
        justification: validated.request.justification,
      },
      policy_chunks: validated.policyChunks,
    };

    const result = await executeWithObservability(
      {
        promptKey: ACCESS_DECISION_PROMPT_KEY,
        model: this.chatClient.model,
        payload,
        execute: (assembledPrompt: string) => this.chatClient.complete(assembledPrompt),
      },
      DecisionSchema,
    );

    if (result.data === null || !result.observation.schemaValid) {
      throw new InternalServerErrorException('Internal server error');
    }

    return result.data;
  }
}
