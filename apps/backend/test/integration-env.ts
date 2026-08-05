import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import { config as loadEnvFile } from 'dotenv';

/**
 * Runs as a Jest `setupFiles` entry, which executes before the spec module (and
 * therefore before the import-time rate-limit config) is loaded.
 */
loadEnvFile({ path: resolve(__dirname, '../.env') });

const runId = `burst-${randomUUID()}`;

process.env.INTEGRATION_RUN_ID = runId;

/**
 * Isolates every BullMQ key for this run so a developer's local queue data is
 * never consumed by the test worker, and vice versa.
 */
process.env.REDIS_QUEUE_PREFIX = `test:${runId}`;

/**
 * Compresses the rate-limit window from 60s to 1.5s. The 100-request burst still
 * overruns the 60-request ceiling by the same ratio, so backpressure, retries
 * and recovery are all exercised, but the suite finishes in seconds.
 */
process.env.DOWNSTREAM_RATE_LIMIT_WINDOW_MS = '1500';
