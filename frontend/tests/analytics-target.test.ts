import { findAnalyticsTargetCandidates, getDefaultAnalyticsTarget, resolveAnalyticsTargetIdentifier } from '../src/lib/analyticsTarget';

jest.mock('../src/lib/nostr', () => ({
  decodeNpub: jest.fn((value: string) => {
    if (value === 'npub1validtarget') return 'a'.repeat(64);
    if (value === 'npub1profileonly') return 'd'.repeat(64);
    return null;
  }),
  encodeNpub: jest.fn((value: string) => `npub-${value.slice(0, 8)}`),
}));

jest.mock('../src/lib/beaconSearch', () => ({
  searchProfiles: jest.fn(),
}));

jest.mock('../src/lib/profileCache', () => ({
  fetchProfilesBatchCached: jest.fn(),
}));

const { searchProfiles } = jest.requireMock('../src/lib/beaconSearch') as { searchProfiles: jest.Mock };
const { fetchProfilesBatchCached } = jest.requireMock('../src/lib/profileCache') as { fetchProfilesBatchCached: jest.Mock };

describe('analytics target resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to logged-in user pubkey when available', () => {
    const target = getDefaultAnalyticsTarget('B'.repeat(64));
    expect(target?.targetPubkey).toBe('b'.repeat(64));
    expect(target?.inputType).toBe('hex');
  });

  it('resolves hex and npub targets', async () => {
    const hex = await resolveAnalyticsTargetIdentifier('A'.repeat(64));
    expect(hex.error).toBeNull();
    expect(hex.resolution?.targetPubkey).toBe('a'.repeat(64));

    const npub = await resolveAnalyticsTargetIdentifier('npub1validtarget');
    expect(npub.error).toBeNull();
    expect(npub.resolution?.targetPubkey).toBe('a'.repeat(64));
    expect(npub.resolution?.inputType).toBe('npub');
  });

  it('resolves nip05 best-effort and fails gracefully when unresolved', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn() as jest.Mock;
    (global as any).fetch = fetchMock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ names: { jack: 'c'.repeat(64) } }),
    });

    const ok = await resolveAnalyticsTargetIdentifier('jack@example.com');
    expect(ok.error).toBeNull();
    expect(ok.resolution?.targetPubkey).toBe('c'.repeat(64));

    fetchMock.mockResolvedValueOnce({ ok: false });
    const bad = await resolveAnalyticsTargetIdentifier('jill@example.com');
    expect(bad.resolution).toBeNull();
    expect(bad.error).toContain('Could not resolve NIP-05');

    (global as any).fetch = originalFetch;
  });

  it('returns searchable candidates from search results when resolution fails', async () => {
    searchProfiles.mockResolvedValue({
      results: [
        {
          pubkey: 'f'.repeat(64),
          npub: 'ignored',
          name: 'alice',
          nip05: 'alice@example.com',
          profile: { display_name: 'Alice' },
        },
      ],
    });
    fetchProfilesBatchCached.mockResolvedValue(new Map());

    const candidates = await findAnalyticsTargetCandidates('alice@example.com');

    expect(searchProfiles).toHaveBeenCalledWith({ query: 'alice@example.com', limit: 20, offset: 0 });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      targetPubkey: 'f'.repeat(64),
      npub: 'npub-ffffffff',
      displayName: 'Alice',
      name: 'alice',
      nip05: 'alice@example.com',
      source: 'search',
    });
  });

  it('includes profile-lookup candidate for decodable npub input', async () => {
    searchProfiles.mockResolvedValue({ results: [] });
    fetchProfilesBatchCached.mockResolvedValue(new Map([
      ['d'.repeat(64), { display_name: 'Delta', name: 'delta', nip05: 'delta@example.com' }],
    ]));

    const candidates = await findAnalyticsTargetCandidates('npub1profileonly');

    expect(fetchProfilesBatchCached).toHaveBeenCalledWith(['d'.repeat(64)]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      targetPubkey: 'd'.repeat(64),
      npub: 'npub-dddddddd',
      displayName: 'Delta',
      name: 'delta',
      nip05: 'delta@example.com',
      source: 'profile',
    });
  });
});
