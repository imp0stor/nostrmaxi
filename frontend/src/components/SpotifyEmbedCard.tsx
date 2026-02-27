import type { AudioRef } from '../lib/media';

function spotifyHeight(type: AudioRef['spotifyType'], compact: boolean): number {
  if (!compact) return 352;
  if (type === 'track' || type === 'episode') return 152;
  return 232;
}

export function SpotifyEmbedCard({ audio, compact = true }: { audio: AudioRef; compact?: boolean }) {
  const sourceUrl = audio.sourceUrl || audio.url;
  const embedUrl = audio.embedUrl;
  const title = audio.spotifyType ? `Spotify ${audio.spotifyType}` : 'Spotify';

  if (!embedUrl || !audio.spotifyType || !audio.spotifyId) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="block rounded-md border border-green-700/60 bg-[#07140f] p-3 hover:border-green-400/80 transition-colors"
      >
        <p className="text-[11px] uppercase tracking-wider text-green-400">Spotify</p>
        <p className="text-sm font-semibold text-green-100">Open on Spotify</p>
        <p className="text-xs text-green-200/75 break-all">{sourceUrl}</p>
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-green-800/70 bg-[#050e0a]">
      <iframe
        src={embedUrl}
        title={`${title} embed`}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="w-full"
        style={{ height: `${spotifyHeight(audio.spotifyType, compact)}px` }}
      />
    </div>
  );
}
