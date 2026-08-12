import {
  ACCESS_GRANT_JOB_ATTEMPTS,
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  ACCESS_REQUEST_JOB_ATTEMPTS,
  DOWNSTREAM_RATE_LIMIT_MAX,
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
  MINIMUM_ACCESS_REQUEST_JOB_ATTEMPTS,
  ORG_BURST_RATE_LIMIT_MAX,
  concurrencyForThroughput,
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
        ORG_BURST_RATE_LIMIT_MAX: 300,
        ORG_BURST_RATE_LIMIT_WINDOW_MS: 60_000,
        INGEST_EXPECTED_JOB_LATENCY_MS: 2_000,
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: 1_000,
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: 250,
        ACCESS_REQUEST_JOB_ATTEMPTS: undefined,
        ACCESS_GRANT_BACKOFF_BASE_DELAY_MS: 1_000,
        ACCESS_GRANT_JOB_ATTEMPTS: 5,
      });
    });

    it('defaults the org-wide burst ceiling above the downstream contract', () => {
      const parsed = parseRateLimitEnv({});

      expect(parsed.ORG_BURST_RATE_LIMIT_MAX).toBeGreaterThan(parsed.DOWNSTREAM_RATE_LIMIT_MAX);
    });

    it('coerces string environment values into positive integers', () => {
      const parsed = parseRateLimitEnv({
        DOWNSTREAM_RATE_LIMIT_MAX: '10',
        DOWNSTREAM_RATE_LIMIT_WINDOW_MS: '1500',
        ORG_BURST_RATE_LIMIT_MAX: '50',
        ORG_BURST_RATE_LIMIT_WINDOW_MS: '1500',
        INGEST_EXPECTED_JOB_LATENCY_MS: '25',
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: '200',
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: '0',
        ACCESS_REQUEST_JOB_ATTEMPTS: '6',
        ACCESS_GRANT_BACKOFF_BASE_DELAY_MS: '50',
        ACCESS_GRANT_JOB_ATTEMPTS: '3',
      });

      expect(parsed).toEqual({
        DOWNSTREAM_RATE_LIMIT_MAX: 10,
        DOWNSTREAM_RATE_LIMIT_WINDOW_MS: 1_500,
        ORG_BURST_RATE_LIMIT_MAX: 50,
        ORG_BURST_RATE_LIMIT_WINDOW_MS: 1_500,
        INGEST_EXPECTED_JOB_LATENCY_MS: 25,
        ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: 200,
        ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: 0,
        ACCESS_REQUEST_JOB_ATTEMPTS: 6,
        ACCESS_GRANT_BACKOFF_BASE_DELAY_MS: 50,
        ACCESS_GRANT_JOB_ATTEMPTS: 3,
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

  describe('concurrencyForThroughput', () => {
    it('sizes in-flight slots to sustain the org-wide burst', () => {
      expect(
        concurrencyForThroughput({
          ratePerWindow: 300,
          windowMs: 60_000,
          expectedJobLatencyMs: 2_000,
        }),
      ).toBe(10);
    });

    it('never drops below a single worker slot', () => {
      expect(
        concurrencyForThroughput({
          ratePerWindow: 1,
          windowMs: 60_000,
          expectedJobLatencyMs: 5,
        }),
      ).toBe(1);
    });

    it('rounds up so the limiter stays the only ceiling', () => {
      expect(
        concurrencyForThroughput({
          ratePerWindow: 300,
          windowMs: 60_000,
          expectedJobLatencyMs: 2_100,
        }),
      ).toBe(11);
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

    it('lets ingest absorb bursts wider than the downstream contract', () => {
      expect(ORG_BURST_RATE_LIMIT_MAX).toBeGreaterThan(DOWNSTREAM_RATE_LIMIT_MAX);
    });

    it('keeps a retry budget for transient grant faults', () => {
      expect(ACCESS_GRANT_JOB_ATTEMPTS).toBeGreaterThan(1);
    });
  });
});
