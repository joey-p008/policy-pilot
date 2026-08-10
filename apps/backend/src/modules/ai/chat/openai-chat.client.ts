import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { z } from 'zod';

import type { LlmExecutionResult } from '../observability/llm-observability.types';
import type { ChatClient } from './chat.types';

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

  public async complete(prompt: string): Promise<LlmExecutionResult> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const content = response.choices[0]?.message.content;
        if (content === null || content === undefined || content.length === 0) {
          throw new Error('OpenAI chat completion returned empty content');
        }

        return {
          content,
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        };
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

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
