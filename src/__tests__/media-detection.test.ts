import { isLikelyImageUrl, isGifUrl, detectMediaType } from '../../frontend/src/lib/mediaDetection';

describe('media detection', () => {
  describe('isGifUrl', () => {
    test('detects .gif extension', () => {
      expect(isGifUrl('https://example.com/image.gif')).toBe(true);
      expect(isGifUrl('https://example.com/image.GIF')).toBe(true);
      expect(isGifUrl('https://example.com/image.gif?v=123')).toBe(true);
    });

    test('returns false for non-GIF images', () => {
      expect(isGifUrl('https://example.com/image.png')).toBe(false);
      expect(isGifUrl('https://example.com/image.jpg')).toBe(false);
      expect(isGifUrl('https://example.com/image.webp')).toBe(false);
    });
  });

  describe('isLikelyImageUrl', () => {
    test('recognizes standard image extensions', () => {
      expect(isLikelyImageUrl('https://example.com/pic.jpg')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/pic.png')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/pic.gif')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/pic.webp')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/pic.avif')).toBe(true);
    });

    test('recognizes known image hosting domains without extensions', () => {
      expect(isLikelyImageUrl('https://i.imgur.com/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://imgur.com/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://i.redd.it/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://preview.redd.it/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://pbs.twimg.com/media/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://media.tenor.com/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://media.giphy.com/media/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://nostr.build/i/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://void.cat/d/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://nostrimg.com/abc123')).toBe(true);
    });

    test('recognizes /image/ or /img/ in path', () => {
      expect(isLikelyImageUrl('https://example.com/image/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/img/abc123')).toBe(true);
      expect(isLikelyImageUrl('https://example.com/media/abc123')).toBe(true);
    });

    test('recognizes Cloudflare image transforms', () => {
      expect(isLikelyImageUrl('https://cdn.example.com/abc?width=800&height=600')).toBe(true);
    });

    test('returns false for non-image URLs', () => {
      expect(isLikelyImageUrl('https://example.com/page.html')).toBe(false);
      expect(isLikelyImageUrl('https://twitter.com/user/status/123')).toBe(false);
      expect(isLikelyImageUrl('https://youtube.com/watch?v=123')).toBe(false);
    });
  });

  describe('detectMediaType', () => {
    test('detects images with MIME type', () => {
      const result = detectMediaType('https://example.com/noext', 'image/png');
      expect(result.type).toBe('image');
      expect(result.isGif).toBe(false);
    });

    test('detects GIFs with MIME type', () => {
      const result = detectMediaType('https://example.com/noext', 'image/gif');
      expect(result.type).toBe('image');
      expect(result.isGif).toBe(true);
    });

    test('detects images with extension', () => {
      const result = detectMediaType('https://example.com/pic.png');
      expect(result.type).toBe('image');
      expect(result.isGif).toBe(false);
    });

    test('detects GIFs with extension', () => {
      const result = detectMediaType('https://example.com/anim.gif');
      expect(result.type).toBe('image');
      expect(result.isGif).toBe(true);
    });

    test('detects videos', () => {
      const result = detectMediaType('https://example.com/video.mp4');
      expect(result.type).toBe('video');
    });

    test('detects audio', () => {
      const result = detectMediaType('https://example.com/song.mp3');
      expect(result.type).toBe('audio');
    });

    test('uses heuristics for extension-less image hosts', () => {
      const result = detectMediaType('https://i.imgur.com/abc123');
      expect(result.type).toBe('image');
    });

    test('returns unknown for unrecognized URLs', () => {
      const result = detectMediaType('https://example.com/page');
      expect(result.type).toBe('unknown');
    });
  });
});
