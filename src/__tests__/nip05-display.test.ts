import { isValidNip05, profileDisplayName } from '../../frontend/src/lib/profileCache';

describe('NIP-05 display behavior', () => {
  test('shows external nip05 when valid', () => {
    expect(profileDisplayName('pubkey12345678', { nip05: 'alice@example.com' } as any)).toBe('alice@example.com');
  });

  test('falls back when nip05 missing/invalid', () => {
    expect(isValidNip05('invalid')).toBe(false);
    expect(profileDisplayName('abcdef1234567890', { nip05: 'invalid', name: 'Alice' } as any)).toBe('Alice');
  });
});
