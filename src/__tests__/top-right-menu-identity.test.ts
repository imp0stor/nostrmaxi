import { resolvePrimaryIdentityDetailed, selectPrimaryIdentityDetailed } from '../../frontend/src/lib/identityResolver';

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

describe('top-right menu identity selection + refresh', () => {
  const user = {
    id: 'u1',
    pubkey: 'pubkey-identity',
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

  test('selects external > managed > npub for top-right display value', () => {
    expect(selectPrimaryIdentityDetailed({ externalNip05: 'alice@example.com', managedNip05: 'managed@nostrmaxi.com', npub: user.npub })).toMatchObject({ value: 'alice@example.com', source: 'external' });
    expect(selectPrimaryIdentityDetailed({ externalNip05: 'broken', managedNip05: 'managed@nostrmaxi.com', npub: user.npub })).toMatchObject({ value: 'managed@nostrmaxi.com', source: 'managed' });
    expect(selectPrimaryIdentityDetailed({ externalNip05: '', managedNip05: '', npub: user.npub })).toMatchObject({ source: 'npub' });
  });

  test('updates after post-login force refresh once relay profile metadata is available', async () => {
    fetchProfileCached
      .mockResolvedValueOnce({ nip05: undefined })
      .mockResolvedValueOnce({ nip05: 'alice@example.com' });

    const first = await resolvePrimaryIdentityDetailed(user, { forceRefresh: false });
    expect(first).toMatchObject({ value: 'managed@nostrmaxi.com', source: 'managed' });

    const refreshed = await resolvePrimaryIdentityDetailed(user, { forceRefresh: true });
    expect(invalidateProfileCache).toHaveBeenCalledWith(user.pubkey);
    expect(refreshed).toMatchObject({ value: 'alice@example.com', source: 'external' });
  });
});
