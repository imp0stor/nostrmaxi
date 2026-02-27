import { readFileSync } from 'fs';
import { join } from 'path';

describe('embed sizing constraints', () => {
  test('platform iframe embed constrains video/audio dimensions and loading state', () => {
    const source = readFileSync(join(process.cwd(), 'frontend/src/components/PlatformIframeEmbed.tsx'), 'utf8');
    expect(source).toContain("max-w-4xl");
    expect(source).toContain("max-w-3xl");
    expect(source).toContain('audioEmbedHeight');
    expect(source).toContain('animate-pulse');
  });

  test('spotify and wavlake embeds are capped and responsive', () => {
    const spotify = readFileSync(join(process.cwd(), 'frontend/src/components/SpotifyEmbedCard.tsx'), 'utf8');
    const wavlake = readFileSync(join(process.cwd(), 'frontend/src/components/WavlakeEmbedCard.tsx'), 'utf8');
    expect(spotify).toContain('max-w-3xl');
    expect(spotify).toContain('return 152');
    expect(spotify).toContain('return 232');
    expect(wavlake).toContain('max-w-3xl');
    expect(wavlake).toContain('compact={compact}');
  });

  test('quoted media passes compact sizing mode to nested embeds', () => {
    const quoted = readFileSync(join(process.cwd(), 'frontend/src/components/QuotedEventCard.tsx'), 'utf8');
    const rich = readFileSync(join(process.cwd(), 'frontend/src/components/RichMedia.tsx'), 'utf8');
    expect(quoted).toContain('compact={compact}');
    expect(rich).toContain('compact = false');
    expect(rich).toContain('spotifyCompact = compact');
  });
});
