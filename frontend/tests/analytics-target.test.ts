import { getDefaultAnalyticsTarget, resolveAnalyticsTargetIdentifier } from '../src/lib/analyticsTarget';

jest.mock('../src/lib/nostr', () => ({
  decodeNpub: jest.fn((value: string) => {
    if (value === 'npub1validtarget') return 'a'.repeat(64);
    return null;
  }),
}));

describe('analytics target resolution', () => {
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
});
