import { isValidNip05, profileDisplayName } from '../src/lib/profileCache';

describe('isValidNip05', () => {
  it('accepts user@domain.tld format', () => {
    expect(isValidNip05('alice@example.com')).toBe(true);
  });

  it('accepts root domain format per NIP-05', () => {
    expect(isValidNip05('imp0stor.com')).toBe(true);
  });

  it('rejects domains without a dot', () => {
    expect(isValidNip05('localhost')).toBe(false);
    expect(isValidNip05('alice@localhost')).toBe(false);
  });

  it('rejects values containing spaces', () => {
    expect(isValidNip05('imp0 stor.com')).toBe(false);
    expect(isValidNip05('alice@imp0 stor.com')).toBe(false);
  });

  it('treats root-domain NIP-05 as valid display name', () => {
    const display = profileDisplayName('abcdef0123456789', { nip05: 'imp0stor.com' } as any);
    expect(display).toBe('imp0stor.com');
  });
});
