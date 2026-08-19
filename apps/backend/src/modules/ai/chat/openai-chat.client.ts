import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { z } from 'zod';

import type { LlmExecutionResult } from '../observability/llm-observability.types';
import type { ChatClient, ChatCompletionOptions } from './chat.types';
import { toLlmExecutionResult, toOpenAiToolChoice, toOpenAiTools } from './map-chat-completion';

const chatEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_CHAT_MODEL: z.string().min(1).default('gpt-4o-mini'),
  OPENAI_CHAT_MAX_RETRIES: z.coerce.number().int().positive().default(5),
});

const BASE_BACKOFF_MS = 500;
const MAX_JITTER_MS = 250;

@Injectable()
export class OpenAiChatClient implements ChatClient {
  private readonly client: OpenAI;
  private readonly maxRetries: number;
  public readonly model: string;

  public constructor(configService: ConfigService) {
    const env = chatEnvSchema.parse({
      OPENAI_API_KEY: configService.get<string>('OPENAI_API_KEY'),
      OPENAI_CHAT_MODEL: configService.get<string>('OPENAI_CHAT_MODEL') ?? 'gpt-4o-mini',
      OPENAI_CHAT_MAX_RETRIES: configService.get<string>('OPENAI_CHAT_MAX_RETRIES') ?? '5',
    });

    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_CHAT_MODEL;
    this.maxRetries = env.OPENAI_CHAT_MAX_RETRIES;
  }

  public async complete(
    prompt: string,
    options?: ChatCompletionOptions,
  ): Promise<LlmExecutionResult> {
    let lastError: unknown;

    const tools = options?.tools;
    const hasTools = tools !== undefined && tools.length > 0;

    if (hasTools && options?.jsonSchema !== undefined) {
      throw new Error('ChatCompletionOptions cannot set both tools and jsonSchema');
    }

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          ...(hasTools
            ? {
                tools: toOpenAiTools(tools),
                ...(options?.toolChoice === undefined
                  ? {}
                  : { tool_choice: toOpenAiToolChoice(options.toolChoice) }),
              }
            : {
                response_format:
                  options?.jsonSchema === undefined
                    ? ({ type: 'json_object' } as const)
                    : ({
                        type: 'json_schema' as const,
                        json_schema: {
                          name: options.schemaName ?? 'structured_output',
                          strict: true,
                          schema: options.jsonSchema,
                        },
                      } as const),
              }),
        });

        const message = response.choices[0]?.message;
        if (message === undefined) {
          throw new Error('OpenAI chat completion returned empty content');
        }

        return toLlmExecutionResult({
          message: {
            content: message.content,
            tool_calls: message.tool_calls
              ?.filter((toolCall) => toolCall.type === 'function')
              .map((toolCall) => ({
                id: toolCall.id,
                type: toolCall.type,
                function: {
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments,
                },
              })),
          },
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        });
      } catch (error: unknown) {
        lastError = error;
        const canRetry = this.isRateLimitError(error) && attempt < this.maxRetries - 1;
        if (!canRetry) {
          throw error;
        }

        const delayMs = BASE_BACKOFF_MS * 2 ** attempt + Math.floor(Math.random() * MAX_JITTER_MS);
        await this.sleep(delayMs);
      }
    }

    throw lastError;
  }

  private isRateLimitError(error: unknown): boolean {
    if (error instanceof APIError) {
      return error.status === 429;
    }

    if (typeof error === 'object' && error !== null && 'status' in error) {
      return (error as { status: unknown }).status === 429;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
