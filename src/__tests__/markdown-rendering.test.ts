import { hasMarkdown } from '../../frontend/src/lib/markdown';
import { parseMediaFromFeedItem } from '../../frontend/src/lib/media';

describe('markdown rendering support', () => {
  test('detects supported markdown syntax', () => {
    expect(hasMarkdown('**bold** _italic_ ~~gone~~')).toBe(true);
    expect(hasMarkdown('`inline` and ```\nblock\n```')).toBe(true);
    expect(hasMarkdown('# Heading\n- list')).toBe(true);
    expect(hasMarkdown('> quote\n[link](https://example.com)')).toBe(true);
  });

  test('falls back for plain text', () => {
    expect(hasMarkdown('just a regular post with no markdown markers')).toBe(false);
  });

  test('does not strip markdown link urls into separate embed tokens', () => {
    const parsed = parseMediaFromFeedItem({
      id: '1',
      pubkey: 'abc',
      created_at: 1,
      kind: 1,
      sig: 'sig',
      tags: [],
      content: 'Read [this guide](https://example.com/guide) please',
    } as any);

    expect(parsed.links).toEqual([]);
    expect(parsed.text).toContain('[this guide](https://example.com/guide)');
  });
});
