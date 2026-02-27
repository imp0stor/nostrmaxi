import { imageLoadingMode, parseMediaFromFeedItem } from '../../frontend/src/lib/media';

describe('media parsing/render helpers', () => {
  test('parses image URL from imeta tag even without file extension', () => {
    const item: any = {
      content: 'look',
      tags: [['imeta', 'url https://cdn.example.com/blob/abc123', 'm image/jpeg']],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.images).toContain('https://cdn.example.com/blob/abc123');
  });

  test('preserves mixed content order for text/image/link/quote tokens inline', () => {
    const item: any = {
      content: 'hello https://img.example.com/pic.jpg world https://example.com/article nostr:note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const types = parsed.tokens.map((t) => t.type);
    expect(types).toEqual(['text', 'image', 'text', 'link', 'text', 'quote']);
  });

  test('deduplicates repeated URLs across text and imeta tags', () => {
    const item: any = {
      content: 'https://cdn.example.com/x.png repeat https://cdn.example.com/x.png',
      tags: [['imeta', 'url https://cdn.example.com/x.png', 'm image/png']],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.images).toEqual(['https://cdn.example.com/x.png']);
    expect(parsed.tokens.filter((t) => t.type === 'image')).toHaveLength(1);
  });

  test('detects wavlake track URLs as audio tokens', () => {
    const item: any = {
      content: 'listen https://wavlake.com/track/92625eb4-4db4-43e5-950e-c987edbd5495 now',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const audioToken = parsed.tokens.find((t: any) => t.type === 'audio') as any;

    expect(audioToken).toBeTruthy();
    expect(audioToken.audio.provider).toBe('wavlake');
    expect(audioToken.audio.trackId).toBe('92625eb4-4db4-43e5-950e-c987edbd5495');
    expect(parsed.text).toBe('listen  now');
  });

  test('detects spotify episode URLs as audio tokens with embed metadata', () => {
    const item: any = {
      content: 'listen https://open.spotify.com/episode/2uidcZ3TCcBEuuV03kJy now',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const audioToken = parsed.tokens.find((t: any) => t.type === 'audio') as any;

    expect(audioToken).toBeTruthy();
    expect(audioToken.audio.provider).toBe('spotify');
    expect(audioToken.audio.spotifyType).toBe('episode');
    expect(audioToken.audio.spotifyId).toBe('2uidcZ3TCcBEuuV03kJy');
    expect(audioToken.audio.embedUrl).toBe('https://open.spotify.com/embed/episode/2uidcZ3TCcBEuuV03kJy');
  });

  test('detects spotify track/album/playlist/show URLs', () => {
    const item: any = {
      content: [
        'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
        'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc',
        'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
        'https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk',
      ].join(' '),
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const spotifyAudios = parsed.audios.filter((a: any) => a.provider === 'spotify');
    expect(spotifyAudios).toHaveLength(4);
    expect(spotifyAudios.map((a: any) => a.spotifyType)).toEqual(['track', 'album', 'playlist', 'show']);
  });

  test('detects spotify locale and embed URLs as spotify audio tokens', () => {
    const item: any = {
      content: [
        'https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC?si=abc',
        'https://open.spotify.com/embed/episode/2uidcZ3TCcBEuuV03kJy',
      ].join(' '),
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    const spotifyAudios = parsed.audios.filter((a: any) => a.provider === 'spotify');

    expect(spotifyAudios).toHaveLength(2);
    expect(spotifyAudios[0].url).toBe('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(spotifyAudios[0].embedUrl).toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(spotifyAudios[1].url).toBe('https://open.spotify.com/episode/2uidcZ3TCcBEuuV03kJy');
    expect(spotifyAudios[1].embedUrl).toBe('https://open.spotify.com/embed/episode/2uidcZ3TCcBEuuV03kJy');
  });

  test('detects major platform embeds across audio/video/social providers', () => {
    const item: any = {
      content: [
        'https://soundcloud.com/forss/flickermood',
        'https://music.apple.com/us/album/1989-taylors-version-deluxe/1713845538',
        'https://artist.bandcamp.com/track/example-track',
        'https://www.mixcloud.com/discover/chill/',
        'https://www.twitch.tv/videos/1064007412',
        'https://rumble.com/v5x5x6-example.html',
        'https://odysee.com/@channel:1/video:2',
        'https://www.instagram.com/reel/Cx123abc/',
        'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      ].join(' '),
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.audios.some((a: any) => a.provider === 'soundcloud' && a.embedUrl?.includes('w.soundcloud.com/player'))).toBe(true);
    expect(parsed.audios.some((a: any) => a.provider === 'appleMusic' && a.embedUrl?.includes('embed.music.apple.com'))).toBe(true);
    expect(parsed.audios.some((a: any) => a.provider === 'bandcamp')).toBe(true);
    expect(parsed.audios.some((a: any) => a.provider === 'mixcloud' && a.embedUrl?.includes('mixcloud.com/widget/iframe'))).toBe(true);

    expect(parsed.videos.some((v: any) => v.type === 'twitch' && v.embedUrl?.includes('twitch.tv'))).toBe(true);
    expect(parsed.videos.some((v: any) => v.type === 'rumble' && v.embedUrl?.includes('rumble.com/embed'))).toBe(true);
    expect(parsed.videos.some((v: any) => v.type === 'odysee' && v.embedUrl?.includes('odysee.com/$/embed'))).toBe(true);
    expect(parsed.videos.some((v: any) => v.type === 'instagram' && v.embedUrl?.includes('instagram.com'))).toBe(true);
    expect(parsed.videos.some((v: any) => v.type === 'tiktok' && v.embedUrl?.includes('tiktok.com/embed'))).toBe(true);
  });

  test('falls back to link token for unknown/unresolved embeds', () => {
    const item: any = {
      content: 'check https://example.com/resource/no-extension',
      tags: [],
    };

    const parsed = parseMediaFromFeedItem(item);
    expect(parsed.tokens.some((t) => t.type === 'link')).toBe(true);
  });

  test('first images load eagerly in viewport strategy', () => {
    expect(imageLoadingMode(0)).toBe('eager');
    expect(imageLoadingMode(1)).toBe('eager');
    expect(imageLoadingMode(2)).toBe('lazy');
  });
});
