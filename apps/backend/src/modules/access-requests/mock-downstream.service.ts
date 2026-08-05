import { Injectable } from '@nestjs/common';

import {
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
} from '../../config/rate-limit.config';

export const MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE = DOWNSTREAM_RATE_LIMIT_MAX;
export const MOCK_DOWNSTREAM_WINDOW_MS = DOWNSTREAM_RATE_LIMIT_WINDOW_MS;

export class MockDownstreamRateLimitError extends Error {
  public constructor() {
    super(
      `Mock downstream rate limit exceeded (${MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE} req / ` +
        `${MOCK_DOWNSTREAM_WINDOW_MS}ms)`,
    );
    this.name = 'MockDownstreamRateLimitError';
  }
}

@Injectable()
export class MockDownstreamService {
  private readonly timestamps: number[] = [];

  public async invoke(): Promise<void> {
    const now = Date.now();
    this.prune(now);

    if (this.timestamps.length >= MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE) {
      throw new MockDownstreamRateLimitError();
    }

    this.timestamps.push(now);
  }

  private prune(now: number): void {
    const windowStart = now - MOCK_DOWNSTREAM_WINDOW_MS;

    while (this.timestamps.length > 0 && this.timestamps[0] < windowStart) {
      this.timestamps.shift();
    }
  }
}
