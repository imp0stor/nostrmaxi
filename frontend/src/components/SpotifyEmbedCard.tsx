import type { AudioRef } from '../lib/media';

function spotifyHeight(type: AudioRef['spotifyType'], compact: boolean): number {
  if (!compact) return 232;
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
        className="block w-full max-w-3xl rounded-lg border border-green-700/60 bg-[#07140f] p-3 hover:border-green-400/80 transition-colors"
      >
        <p className="text-[11px] uppercase tracking-wider text-green-400">Spotify</p>
        <p className="text-sm font-semibold text-green-100">Open on Spotify</p>
        <p className="text-xs text-green-200/75 break-all">{sourceUrl}</p>
      </a>
    );
  }

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-green-800/70 bg-[#050e0a] shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
      <div className="relative">
        <div className="absolute inset-0 animate-pulse bg-green-900/15" aria-hidden="true" />
        <iframe
          src={embedUrl}
          title={`${title} embed`}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className="relative z-10 w-full"
          style={{ height: `${spotifyHeight(audio.spotifyType, compact)}px` }}
        />
      </div>
    </div>
  );
}
