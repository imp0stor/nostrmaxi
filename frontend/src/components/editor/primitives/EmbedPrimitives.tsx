import type { EmbedItem, EmbedPlatform } from '../types';

export const inferEmbedPlatform = (url: string): EmbedPlatform => {
  const normalized = url.toLowerCase();
  if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
  if (normalized.includes('vimeo.com')) return 'vimeo';
  if (normalized.includes('spotify.com')) return 'spotify';
  if (normalized.includes('twitter.com') || normalized.includes('x.com')) return 'twitter';
  if (normalized.includes('github.com')) return 'github';
  return 'generic';
};

export const EmbedSelector = ({ value, onChange }: { value: EmbedPlatform; onChange: (platform: EmbedPlatform) => void }) => (
  <label>Embed platform<select aria-label="embed-platform" value={value} onChange={(e)=>onChange(e.target.value as EmbedPlatform)}>{['youtube','vimeo','spotify','twitter','github','generic'].map((p)=><option key={p} value={p}>{p}</option>)}</select></label>
);

export const URLEmbed = ({ value, onChange }: { value: string; onChange: (url: string) => void }) => (
  <label>Embed URL<input aria-label="embed-url" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="https://" /></label>
);

export const EmbedPreview = ({ embed }: { embed: EmbedItem }) => (
  <article aria-label={`embed-preview-${embed.platform}`}>
    <div>{embed.platform.toUpperCase()}</div>
    <a href={embed.url}>{embed.url}</a>
  </article>
);
