import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parse as parseDotenv } from 'dotenv';

const ROOT_DIR = resolve(__dirname, '..');
export const BACKEND_ENV_PATH = join(ROOT_DIR, 'apps', 'backend', '.env');

/**
 * Loads `apps/backend/.env` into `process.env` when the file exists.
 * Existing environment variables win so CI can inject secrets without a file.
 */
export function loadBackendEnv(envFilePath: string = BACKEND_ENV_PATH): void {
  if (!existsSync(envFilePath)) {
    return;
  }

  const parsed = parseDotenv(readFileSync(envFilePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}
