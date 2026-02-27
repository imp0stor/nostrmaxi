import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('inline audio component rendering contract', () => {
  test('inline content includes audio card branch with playback and fallback link button', () => {
    const source = readFileSync(join(process.cwd(), 'frontend/src/components/InlineContent.tsx'), 'utf8');

    expect(source).toContain("if (token.type === 'audio')");
    expect(source).toContain('Open link');
    expect(source).toContain('Inline playback unavailable; open the source link to play.');
  });

  test('inline content routes spotify audio tokens through spotify embed component', () => {
    const source = readFileSync(join(process.cwd(), 'frontend/src/components/InlineContent.tsx'), 'utf8');

    expect(source).toContain("token.audio.provider === 'spotify'");
    expect(source).toContain('<SpotifyEmbedCard');
  });

  test('spotify embed component includes iframe and branded fallback card', () => {
    const source = readFileSync(join(process.cwd(), 'frontend/src/components/SpotifyEmbedCard.tsx'), 'utf8');

    expect(source).toContain('src={embedUrl}');
    expect(source).toContain('Open on Spotify');
    expect(source).toContain('<iframe');
  });

  test('rich media routes spotify audio tokens through spotify embed component', () => {
    const source = readFileSync(join(process.cwd(), 'frontend/src/components/RichMedia.tsx'), 'utf8');

    expect(source).toContain("audio.provider === 'spotify'");
    expect(source).toContain('<SpotifyEmbedCard');
  });

  test('inline and rich media use platform iframe embeds for non-spotify providers and social video platforms', () => {
    const inlineSource = readFileSync(join(process.cwd(), 'frontend/src/components/InlineContent.tsx'), 'utf8');
    const richSource = readFileSync(join(process.cwd(), 'frontend/src/components/RichMedia.tsx'), 'utf8');

    expect(inlineSource).toContain('PlatformIframeEmbed');
    expect(inlineSource).toContain("['soundcloud', 'appleMusic', 'bandcamp', 'mixcloud']");
    expect(inlineSource).toContain("token.video.type !== 'direct'");

    expect(richSource).toContain('PlatformIframeEmbed');
    expect(richSource).toContain("['soundcloud', 'appleMusic', 'bandcamp', 'mixcloud']");
    expect(richSource).toContain("video.type !== 'direct'");
  });
});
