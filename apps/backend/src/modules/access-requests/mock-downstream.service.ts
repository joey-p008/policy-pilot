import { Injectable } from '@nestjs/common';

import {
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} from '../../config/rate-limit.config';

export const MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE = DOWNSTREAM_RATE_LIMIT_MAX;
export const MOCK_DOWNSTREAM_WINDOW_MS = DOWNSTREAM_RATE_LIMIT_WINDOW_MS;

export class MockDownstreamRateLimitError extends Error {
  /**
   * Milliseconds until the oldest in-window call ages out and a slot frees.
   * The grant worker forwards this to BullMQ's manual rate limit so it pauses
   * for exactly as long as the downstream is saturated.
   */
  public readonly retryAfterMs: number;

  public constructor(retryAfterMs: number) {
    super(
      `Mock downstream rate limit exceeded (${MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE} req / ` +
        `${MOCK_DOWNSTREAM_WINDOW_MS}ms), retry after ${retryAfterMs}ms`,
    );
    this.name = 'MockDownstreamRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

@Injectable()
export class MockDownstreamService {
  private readonly timestamps: number[] = [];

  public async invoke(): Promise<void> {
    const now = Date.now();
    this.prune(now);

    if (this.timestamps.length >= MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE) {
      throw new MockDownstreamRateLimitError(this.retryAfterMs(now));
    }

    this.timestamps.push(now);
  }

  private prune(now: number): void {
    const windowStart = now - MOCK_DOWNSTREAM_WINDOW_MS;

    while (this.timestamps.length > 0 && this.timestamps[0] < windowStart) {
      this.timestamps.shift();
    }
  }

  /**
   * Assumes {@link prune} already ran, so the head of the array is the oldest
   * call still occupying a slot in the sliding window.
   */
  private retryAfterMs(now: number): number {
    const oldest = this.timestamps[0];

    if (oldest === undefined) {
      return 0;
    }

    return Math.max(1, oldest + MOCK_DOWNSTREAM_WINDOW_MS - now);
  }
}
