import { resolvePrimaryIdentity } from '../../frontend/src/lib/identityResolver';

const invalidateProfileCache = jest.fn();
const fetchProfileCached = jest.fn();

jest.mock('../../frontend/src/lib/profileCache', () => ({
  invalidateProfileCache: (pubkey?: string) => invalidateProfileCache(pubkey),
  fetchProfileCached: (pubkey: string) => fetchProfileCached(pubkey),
  isValidNip05: (value?: string | null) => Boolean(value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())),
}));

jest.mock('../../frontend/src/lib/api', () => ({
  api: {
    getToken: () => 'token',
  },
}));

describe('resolvePrimaryIdentity refresh + fallback behavior', () => {
  const user = {
    id: 'u1',
    pubkey: 'pubkey-123',
    npub: 'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
    role: 'user',
    tier: 'FREE',
    nip05s: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ identities: [{ source: 'managed', address: 'managed@nostrmaxi.com', verified: true }] }),
    });
  });

  test('invalidates cache when forceRefresh=true and still prefers external nip05', async () => {
    fetchProfileCached.mockResolvedValue({ nip05: 'alice@example.com' });

    const out = await resolvePrimaryIdentity(user, { forceRefresh: true });

    expect(invalidateProfileCache).toHaveBeenCalledWith(user.pubkey);
    expect(out).toBe('alice@example.com');
  });

  test('falls back to managed nip05 when external nip05 is invalid', async () => {
    fetchProfileCached.mockResolvedValue({ nip05: 'not-a-nip05' });

    const out = await resolvePrimaryIdentity(user);

    expect(out).toBe('managed@nostrmaxi.com');
  });
});
