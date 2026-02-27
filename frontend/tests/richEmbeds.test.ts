import { parseMediaFromFeedItem } from '../src/lib/media';
import { extractGitHubRepo, extractTweetId, toFxTwitterUrl } from '../src/lib/richEmbeds';

describe('rich embed parsing', () => {
  it('parses YouTube, Vimeo, and direct videos as video tokens', () => {
    const item: any = {
      content: 'https://youtu.be/dQw4w9WgXcQ https://vimeo.com/148751763 https://cdn.example.com/movie.mp4',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.videos).toHaveLength(3);
    expect(parsed.videos.some((v) => v.type === 'youtube')).toBe(true);
    expect(parsed.videos.some((v) => v.type === 'vimeo')).toBe(true);
    expect(parsed.videos.some((v) => v.type === 'direct')).toBe(true);
  });

  it('parses Spotify, Wavlake, and direct audio links', () => {
    const item: any = {
      content: 'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6 https://wavlake.com/track/abc123 https://cdn.example.com/audio.mp3',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.audios).toHaveLength(3);
    expect(parsed.audios.some((a) => a.provider === 'spotify')).toBe(true);
    expect(parsed.audios.some((a) => a.provider === 'wavlake')).toBe(true);
    expect(parsed.audios.some((a) => a.provider === 'direct')).toBe(true);
  });

  it('extracts tweet and github link metadata helpers', () => {
    expect(extractTweetId('https://x.com/jack/status/1234567890')).toBe('1234567890');
    expect(toFxTwitterUrl('https://twitter.com/jack/status/1234567890')).toBe('https://fxtwitter.com/jack/status/1234567890');
    expect(extractGitHubRepo('https://github.com/vercel/next.js')).toEqual({ owner: 'vercel', repo: 'next.js' });
  });
});
