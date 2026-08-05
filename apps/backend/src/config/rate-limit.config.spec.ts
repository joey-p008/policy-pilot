import {
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
  MINIMUM_ACCESS_REQUEST_JOB_ATTEMPTS,
  cumulativeBackoffMs,
  minimumAttemptsForWindow,
  parseRateLimitEnv,
  resolveJobAttempts,
} from './rate-limit.config';

describe('rate-limit.config', () => {
  describe('parseRateLimitEnv', () => {
    it('falls back to the production downstream contract when nothing is set', () => {
      expect(parseRateLimitEnv({})).toEqual({
        DOWNSTREAM_RATE_LIMIT_MAX: 60,
        DOWNSTREAM_RATE_LIMIT_WINDOW_MS: 60_000,
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: 1_000,
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: 250,
        ACCESS_REQUEST_JOB_ATTEMPTS: undefined,
      });
    });

    it('coerces string environment values into positive integers', () => {
      const parsed = parseRateLimitEnv({
        DOWNSTREAM_RATE_LIMIT_MAX: '10',
        DOWNSTREAM_RATE_LIMIT_WINDOW_MS: '1500',
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: '200',
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: '0',
        ACCESS_REQUEST_JOB_ATTEMPTS: '6',
      });

      expect(parsed).toEqual({
        DOWNSTREAM_RATE_LIMIT_MAX: 10,
        DOWNSTREAM_RATE_LIMIT_WINDOW_MS: 1_500,
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: 200,
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: 0,
        ACCESS_REQUEST_JOB_ATTEMPTS: 6,
      });
    });

    it('rejects a non-positive rate limit ceiling', () => {
      expect(() => parseRateLimitEnv({ DOWNSTREAM_RATE_LIMIT_MAX: '0' })).toThrow();
    });

    it('rejects a fractional window', () => {
      expect(() => parseRateLimitEnv({ DOWNSTREAM_RATE_LIMIT_WINDOW_MS: '1500.5' })).toThrow();
    });

    it('rejects a non-numeric window', () => {
      expect(() => parseRateLimitEnv({ DOWNSTREAM_RATE_LIMIT_WINDOW_MS: 'soon' })).toThrow();
    });
  });

  describe('cumulativeBackoffMs', () => {
    it('reports a zero budget for a single attempt', () => {
      expect(cumulativeBackoffMs(1, 1_000)).toBe(0);
      expect(cumulativeBackoffMs(0, 1_000)).toBe(0);
    });

    it('sums the doubling BullMQ delays across retries', () => {
      expect(cumulativeBackoffMs(2, 1_000)).toBe(1_000);
      expect(cumulativeBackoffMs(5, 1_000)).toBe(15_000);
      expect(cumulativeBackoffMs(8, 1_000)).toBe(127_000);
    });
  });

  describe('minimumAttemptsForWindow', () => {
    it('returns the first attempt count that outlasts the window', () => {
      expect(minimumAttemptsForWindow(60_000, 1_000)).toBe(7);
      expect(minimumAttemptsForWindow(1_500, 1_000)).toBe(3);
      expect(minimumAttemptsForWindow(1_000, 1_000)).toBe(2);
    });

    it('throws instead of looping forever on an uncoverable window', () => {
      expect(() => minimumAttemptsForWindow(Number.MAX_SAFE_INTEGER, 1)).toThrow(/Unable to cover/);
    });
  });

  describe('resolveJobAttempts', () => {
    it('adds a margin attempt above the minimum needed for the window', () => {
      expect(resolveJobAttempts({ windowMs: 60_000, baseDelayMs: 1_000 })).toBe(8);
    });

    it('never drops below the resiliency floor for a compressed window', () => {
      expect(resolveJobAttempts({ windowMs: 1_500, baseDelayMs: 1_000 })).toBe(
        MINIMUM_ACCESS_REQUEST_JOB_ATTEMPTS,
      );
    });

    it('honours an explicit override', () => {
      expect(resolveJobAttempts({ windowMs: 60_000, baseDelayMs: 1_000, override: 3 })).toBe(3);
    });
  });

  describe('resolved configuration', () => {
    it('keeps the retry budget larger than one full rate-limit window', () => {
      expect(
        cumulativeBackoffMs(ACCESS_REQUEST_JOB_ATTEMPTS, ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS),
      ).toBeGreaterThanOrEqual(DOWNSTREAM_RATE_LIMIT_WINDOW_MS);
    });

    it('exposes a positive downstream ceiling', () => {
      expect(DOWNSTREAM_RATE_LIMIT_MAX).toBeGreaterThan(0);
    });
  });
});
