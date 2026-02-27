import { parseMediaFromFeedItem } from '../../frontend/src/lib/media';

describe('inline rendering placement contract', () => {
  test('inline image and quote remain between surrounding text blocks', () => {
    const item: any = {
      content: 'A https://site.test/a.jpg B nostr:note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq C',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const simplified = parsed.tokens.map((t: any) => {
      if (t.type === 'text') return `text:${t.text.trim()}`;
      return t.type;
    }).filter(Boolean);

    expect(simplified).toEqual(['text:A', 'image', 'text:B', 'quote', 'text:C']);
  });

  test('tag-only quote refs are appended as safe fallback embeds', () => {
    const item: any = {
      content: 'plain text only',
      tags: [['e', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef']],
    };

    const parsed = parseMediaFromFeedItem(item);
    const quote = parsed.tokens.find((t) => t.type === 'quote') as any;
    expect(quote).toBeTruthy();
    expect(quote.eventId).toBe('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });
});
