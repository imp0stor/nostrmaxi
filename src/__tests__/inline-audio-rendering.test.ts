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
});
