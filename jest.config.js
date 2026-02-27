module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/frontend/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        jsx: 'react-jsx',
      }
    }],
  },
  collectCoverageFrom: [
    // Focused production-critical surfaces under active test automation
    'src/auth/auth.controller.ts',
    'src/auth/auth.service.ts',
    'src/auth/nostr-role.guard.ts',
    'src/nip05/nip05.controller.ts',
    'src/nip05/nip05.service.ts',
    'src/payments/payments.controller.ts',
    'src/payments/payments.service.ts',
    'src/identity/identity.controller.ts',
    'src/identity/identity.service.ts',
    'src/search/search.service.ts',
    'src/settings/settings.service.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 58,
      functions: 75,
      lines: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^nostr-tools$': '<rootDir>/src/__tests__/mocks/nostr-tools.ts',
    '^@noble/curves/secp256k1$': '<rootDir>/src/__tests__/mocks/nostr-tools.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000,
  maxWorkers: 1, // Avoid database conflicts
};
