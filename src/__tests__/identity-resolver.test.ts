import { selectPrimaryIdentity } from '../../frontend/src/lib/identityResolver';

jest.mock('../../frontend/src/lib/api', () => ({
  api: {
    getToken: () => 'token',
  },
}));

describe('header identity resolver', () => {
  test('prefers external valid nip05 over managed and npub', () => {
    const out = selectPrimaryIdentity({
      externalNip05: 'alice@example.com',
      managedNip05: 'alice@nostrmaxi.com',
      npub: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    });
    expect(out).toBe('alice@example.com');
  });

  test('falls back to managed nip05 then npub', () => {
    const managed = selectPrimaryIdentity({ externalNip05: 'bad-nip05', managedNip05: 'alice@nostrmaxi.com', npub: 'npub1abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd' });
    expect(managed).toBe('alice@nostrmaxi.com');

    const npub = selectPrimaryIdentity({ externalNip05: undefined, managedNip05: undefined, npub: 'npub1abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcdabcd' });
    expect(npub).toContain('...');
  });
});
