import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIError } from 'openai';
import { z } from 'zod';

import { EMBEDDING_DIMENSIONS, EmbeddingClient } from './embedding.types';

const embeddingEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default('text-embedding-3-small'),
  OPENAI_EMBEDDING_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  OPENAI_EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(64),
});

const BASE_BACKOFF_MS = 500;
const MAX_JITTER_MS = 250;

@Injectable()
export class OpenAiEmbeddingClient implements EmbeddingClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly maxRetries: number;
  private readonly batchSize: number;

  public constructor(configService: ConfigService) {
    const env = embeddingEnvSchema.parse({
      OPENAI_API_KEY: configService.get<string>('OPENAI_API_KEY'),
      OPENAI_EMBEDDING_MODEL:
        configService.get<string>('OPENAI_EMBEDDING_MODEL') ?? 'text-embedding-3-small',
      OPENAI_EMBEDDING_MAX_RETRIES:
        configService.get<string>('OPENAI_EMBEDDING_MAX_RETRIES') ?? '5',
      OPENAI_EMBEDDING_BATCH_SIZE: configService.get<string>('OPENAI_EMBEDDING_BATCH_SIZE') ?? '64',
    });

    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_EMBEDDING_MODEL;
    this.maxRetries = env.OPENAI_EMBEDDING_MAX_RETRIES;
    this.batchSize = env.OPENAI_EMBEDDING_BATCH_SIZE;
  }

  public async embedTexts(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += this.batchSize) {
      const batch = texts.slice(offset, offset + this.batchSize);
      const batchEmbeddings = await this.embedBatchWithRetry(batch);
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  private async embedBatchWithRetry(batch: string[]): Promise<number[][]> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: batch,
          dimensions: EMBEDDING_DIMENSIONS,
        });

        const sorted = [...response.data].sort((left, right) => left.index - right.index);
        return sorted.map((item) => {
          if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
            throw new Error(
              `Expected embedding length ${EMBEDDING_DIMENSIONS}, received ${item.embedding.length}`,
            );
          }
          return item.embedding;
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

  private async sleep(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
