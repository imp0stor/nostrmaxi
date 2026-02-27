import {
  buildIdentityProofGuidance,
  parseNip39Identities,
  verifyExternalIdentity,
  type ExternalIdentityProof,
} from '../src/hooks/useExternalIdentities';

describe('NIP-39 external identity parsing + verification', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('parses identities from profile `i` entries', () => {
    const profile = {
      i: [
        ['github:jack', 'https://gist.github.com/jack/proof/1'],
        ['x:jack', 'https://x.com/jack/status/123'],
      ],
    };

    const result = parseNip39Identities(profile);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ platform: 'github', identity: 'github:jack', verificationStatus: 'unverified' });
    expect(result[1]).toMatchObject({ platform: 'x', identity: 'x:jack', verificationStatus: 'unverified' });
  });

  it('parses identities from `i` tags and deduplicates', () => {
    const profile = {
      i: [['github:jack', 'proof-a']],
      tags: [
        ['i', 'github:jack', 'proof-a'],
        ['i', 'telegram:jackmaxi', 'https://t.me/jackmaxi'],
      ],
    };

    const result = parseNip39Identities(profile);
    expect(result).toHaveLength(2);
    expect(result.find((v) => v.platform === 'github')).toBeDefined();
    expect(result.find((v) => v.platform === 'telegram')).toBeDefined();
  });

  it('verifies github proof and enriches profile stats', async () => {
    const fetchMock = jest.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ login: 'jack', public_repos: 3, followers: 9, html_url: 'https://github.com/jack' }),
      } as Response)
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ([{ language: 'TypeScript' }, { language: 'Rust' }]),
      } as Response);

    const identity: ExternalIdentityProof = {
      platform: 'github',
      identity: 'github:jack',
      proof: 'https://gist.github.com/jack/abc',
      verified: false,
      verificationStatus: 'unverified',
    };

    const result = await verifyExternalIdentity(identity);
    expect(result.verificationStatus).toBe('verified');
    expect(result.github?.publicRepos).toBe(3);
    expect(result.github?.languages).toEqual(expect.arrayContaining(['TypeScript', 'Rust']));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('verifies twitter proof url format', async () => {
    const identity: ExternalIdentityProof = {
      platform: 'x',
      identity: 'x:jack',
      proof: 'https://x.com/jack/status/12345',
      verified: false,
      verificationStatus: 'unverified',
    };

    const result = await verifyExternalIdentity(identity);
    expect(result.verificationStatus).toBe('verified');
    expect(result.twitter?.handle).toBe('jack');
  });

  it('builds provider-specific guidance', () => {
    expect(buildIdentityProofGuidance({ platform: 'github', identity: 'github:neo', verified: false, verificationStatus: 'unverified' })).toContain('GitHub');
    expect(buildIdentityProofGuidance({ platform: 'x', identity: 'x:neo', verified: false, verificationStatus: 'unverified' })).toContain('tweet');
  });
});
