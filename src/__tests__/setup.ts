/**
 * Global test setup
 */

// Extend Jest timeout for integration tests
jest.setTimeout(10000);

// Suppress console logs in tests (comment out for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
};

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.NIP05_DEFAULT_DOMAIN = 'test.nostrmaxi.com';
process.env.LNBITS_URL = 'https://test.lnbits.com';
process.env.LNBITS_API_KEY = 'test-api-key';
process.env.BASE_URL = 'http://localhost:3000';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_TTL = '60';
