const { parseArgs } = require('../../bin/nostrmaxi.js');

describe('nostrmaxi CLI arg parsing', () => {
  it('parses verify command', () => {
    expect(parseArgs(['verify', 'npub123'])).toEqual({ type: 'verify', npub: 'npub123' });
  });

  it('parses register command', () => {
    expect(parseArgs(['register', 'user@example.com', 'npub123'])).toEqual({
      type: 'register',
      address: 'user@example.com',
      npub: 'npub123',
    });
  });

  it('errors on missing verify npub', () => {
    expect(() => parseArgs(['verify'])).toThrow('Usage: nostrmaxi verify <npub>');
  });

  it('errors on incomplete register args', () => {
    expect(() => parseArgs(['register', 'user@example.com'])).toThrow(
      'Usage: nostrmaxi register <user@domain.com> <npub>',
    );
  });
});
