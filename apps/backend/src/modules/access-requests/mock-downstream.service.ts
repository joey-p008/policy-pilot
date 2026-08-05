import { Injectable } from '@nestjs/common';

export const MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE = 60;
export const MOCK_DOWNSTREAM_WINDOW_MS = 60_000;

export class MockDownstreamRateLimitError extends Error {
  public constructor() {
    super('Mock downstream rate limit exceeded (60 req/min)');
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
