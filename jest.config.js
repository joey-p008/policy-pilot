/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/shared'],
  testMatch: ['**/*.{spec,test}.{ts,tsx}'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  moduleNameMapper: {
    '^@policy-pilot/shared$': '<rootDir>/shared/pii/mask-pii.ts',
    '^@policy-pilot/shared/(.*)$': '<rootDir>/shared/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          module: 'commonjs',
          moduleResolution: 'node',
          isolatedModules: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  clearMocks: true,
  collectCoverageFrom: [
    'apps/**/*.{ts,tsx}',
    'shared/**/*.{ts,tsx}',
    '!**/*.spec.ts',
    '!**/*.test.ts',
    '!**/*.spec.tsx',
    '!**/*.test.tsx',
    '!**/dist/**',
  ],
};
