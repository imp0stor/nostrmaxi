import { parseMediaFromFeedItem } from '../../frontend/src/lib/media';

describe('inline rendering regressions', () => {
  test('consumes recognized tokens without duplicating raw token text', () => {
    const parsed = parseMediaFromFeedItem({
      id: 'x',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'hi https://img.example.com/a.jpg there',
      tags: [],
    } as any);

    expect(parsed.tokens.map((t) => t.type)).toEqual(['text', 'image', 'text']);
    expect(parsed.text).toBe('hi  there');
  });

  test('converts nprofile/npub reference into profile token', () => {
    const parsed = parseMediaFromFeedItem({
      id: 'x',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'nostr:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      tags: [],
    } as any);

    expect(parsed.tokens[0].type).toBe('profile');
  });

  test('image token appears in initial parse for immediate render without interaction', () => {
    const parsed = parseMediaFromFeedItem({
      id: 'x',
      pubkey: 'p',
      kind: 1,
      created_at: 1,
      sig: '',
      content: 'https://cdn.example.com/pic.png',
      tags: [],
    } as any);

    expect(parsed.images).toEqual(['https://cdn.example.com/pic.png']);
    expect(parsed.tokens[0]).toEqual({ type: 'image', url: 'https://cdn.example.com/pic.png' });
  });
});
