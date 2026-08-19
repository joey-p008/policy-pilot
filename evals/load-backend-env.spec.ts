import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadBackendEnv } from './load-backend-env';

describe('loadBackendEnv', () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalRedisHost = process.env.REDIS_HOST;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'policy-pilot-env-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }

    if (originalRedisHost === undefined) {
      delete process.env.REDIS_HOST;
    } else {
      process.env.REDIS_HOST = originalRedisHost;
    }
  });

  it('does nothing when the env file is missing', () => {
    expect(() => loadBackendEnv(join(tempDir, 'missing.env'))).not.toThrow();
  });

  it('loads unset keys and leaves existing environment variables unchanged', () => {
    const envPath = join(tempDir, '.env');
    writeFileSync(envPath, 'OPENAI_API_KEY=from-file\nREDIS_HOST=from-file\n');

    process.env.OPENAI_API_KEY = 'already-set';
    delete process.env.REDIS_HOST;

    loadBackendEnv(envPath);

    expect(process.env.OPENAI_API_KEY).toBe('already-set');
    expect(process.env.REDIS_HOST).toBe('from-file');
  });
});
