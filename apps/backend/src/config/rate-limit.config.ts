import { z } from 'zod';

/**
 * Read at module-import time rather than through ConfigService: the BullMQ
 * `@Processor` decorator evaluates its worker options (including `limiter`) at
 * class-decoration time, before the Nest DI container exists.
 */
const rateLimitEnvSchema = z.object({
  DOWNSTREAM_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  DOWNSTREAM_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS: z.coerce.number().int().positive().default(1_000),
  ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS: z.coerce.number().int().nonnegative().default(250),
  ACCESS_REQUEST_JOB_ATTEMPTS: z.coerce.number().int().min(1).optional(),
});

export type RateLimitEnv = z.infer<typeof rateLimitEnvSchema>;

export function parseRateLimitEnv(source: Record<string, string | undefined>): RateLimitEnv {
  return rateLimitEnvSchema.parse(source);
}

/**
 * Floor kept so a compressed test window can never shrink the retry budget
 * below the resiliency baseline asserted by the worker unit suite.
 */
export const MINIMUM_ACCESS_REQUEST_JOB_ATTEMPTS = 5;

const MAX_ATTEMPTS_SEARCH_CEILING = 32;

/**
 * Total wall-clock time BullMQ spends in exponential backoff across every
 * retry of a job: sum of `baseDelayMs * 2^n` for n in [0, attempts - 2].
 */
export function cumulativeBackoffMs(attempts: number, baseDelayMs: number): number {
  if (attempts <= 1) {
    return 0;
  }

  return baseDelayMs * (2 ** (attempts - 1) - 1);
}

/**
 * Smallest attempt count whose cumulative backoff outlasts a full rate-limit
 * window, so a job rejected at the start of a saturated window can still
 * succeed once that window drains.
 */
export function minimumAttemptsForWindow(windowMs: number, baseDelayMs: number): number {
  for (let attempts = 1; attempts <= MAX_ATTEMPTS_SEARCH_CEILING; attempts += 1) {
    if (cumulativeBackoffMs(attempts, baseDelayMs) >= windowMs) {
      return attempts;
    }
  }

  throw new Error(
    `Unable to cover a ${windowMs}ms rate-limit window with a ${baseDelayMs}ms backoff base ` +
      `within ${MAX_ATTEMPTS_SEARCH_CEILING} attempts`,
  );
}

export interface ResolveJobAttemptsParams {
  windowMs: number;
  baseDelayMs: number;
  override?: number;
}

export function resolveJobAttempts(params: ResolveJobAttemptsParams): number {
  if (params.override !== undefined) {
    return params.override;
  }

  const required = minimumAttemptsForWindow(params.windowMs, params.baseDelayMs) + 1;

  return Math.max(MINIMUM_ACCESS_REQUEST_JOB_ATTEMPTS, required);
}

const rateLimitEnv: RateLimitEnv = parseRateLimitEnv(process.env);

export const DOWNSTREAM_RATE_LIMIT_MAX = rateLimitEnv.DOWNSTREAM_RATE_LIMIT_MAX;
export const DOWNSTREAM_RATE_LIMIT_WINDOW_MS = rateLimitEnv.DOWNSTREAM_RATE_LIMIT_WINDOW_MS;
export const ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS =
  rateLimitEnv.ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS;
export const ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS =
  rateLimitEnv.ACCESS_REQUEST_BACKOFF_MAX_JITTER_MS;

export const ACCESS_REQUEST_JOB_ATTEMPTS = resolveJobAttempts({
  windowMs: DOWNSTREAM_RATE_LIMIT_WINDOW_MS,
  baseDelayMs: ACCESS_REQUEST_BACKOFF_BASE_DELAY_MS,
  override: rateLimitEnv.ACCESS_REQUEST_JOB_ATTEMPTS,
});
