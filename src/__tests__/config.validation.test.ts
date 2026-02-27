import { formatValidationResult, validateConfiguration } from '../config/validation';

describe('Configuration validation', () => {
  const envBackup = { ...process.env };

  const setValidEnv = () => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/nostrmaxi';
    process.env.DOMAIN = 'nostrmaxi.strangesignal.ai';
    process.env.BASE_URL = 'https://nostrmaxi.strangesignal.ai';
    process.env.ADMIN_PUBKEYS = 'a'.repeat(64);
    process.env.CORS_ORIGINS = 'https://nostrmaxi.strangesignal.ai';
    process.env.PAYMENTS_PROVIDER = 'btcpay';
    process.env.BTCPAY_URL = 'https://btcpay.strangesignal.ai';
    process.env.BTCPAY_API_KEY = 'api-key-real';
    process.env.BTCPAY_STORE_ID = 'store-real';
    process.env.BTCPAY_WEBHOOK_SECRET = 's'.repeat(32);
    process.env.WEBHOOK_SECRET = 'w'.repeat(32);
    process.env.NODE_ENV = 'production';
  };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterAll(() => {
    process.env = envBackup;
  });

  it('passes with valid production config', () => {
    setValidEnv();
    const result = validateConfiguration();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails for wildcard cors and missing admin pubkeys', () => {
    setValidEnv();
    delete process.env.ADMIN_PUBKEYS;
    process.env.CORS_ORIGINS = '*';

    const result = validateConfiguration();
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'ADMIN_PUBKEYS is required - no admin access configured!',
      'CORS_ORIGINS cannot be wildcard (*) - security risk',
    ]));
  });

  it('supports skipPaymentValidation for local/dev', () => {
    setValidEnv();
    delete process.env.BTCPAY_URL;
    delete process.env.BTCPAY_API_KEY;
    delete process.env.BTCPAY_STORE_ID;

    const result = validateConfiguration({ skipPaymentValidation: true });
    expect(result.valid).toBe(true);
  });

  it('formats human-readable output', () => {
    const text = formatValidationResult({ valid: false, errors: ['A'], warnings: ['B'] });
    expect(text).toContain('FAILED');
    expect(text).toContain('ERRORS');
    expect(text).toContain('WARNINGS');
  });
});
