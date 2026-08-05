/**
 * Integration suite: requires live Postgres and Redis (docker compose up -d).
 * Kept out of the default `npm test` run so the pre-commit verification gate
 * stays infrastructure-free.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/backend/test'],
  testMatch: ['**/*.integration-spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@policy-pilot/shared$': '<rootDir>/shared/pii/mask-pii.ts',
    '^@policy-pilot/shared/(.*)$': '<rootDir>/shared/$1',
  },
  setupFiles: ['<rootDir>/apps/backend/test/integration-env.ts'],
  // Counters installed via jest.spyOn must survive across tests in a file.
  clearMocks: false,
  maxWorkers: 1,
  testTimeout: 120_000,
};
