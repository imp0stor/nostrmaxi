import type { AudioRef } from '../lib/media';
import type { LinkPreview } from '../lib/richEmbeds';
import { PlatformIframeEmbed } from './PlatformIframeEmbed';

export function WavlakeEmbedCard({ audio, preview, compact = false }: { audio: AudioRef; preview?: LinkPreview; compact?: boolean }) {
  const sourceUrl = audio.sourceUrl || audio.url;
  const playable = preview?.audio;

  return (
    <div className="w-full max-w-3xl rounded-lg border border-purple-900/70 bg-[#0a0920] p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-purple-300 truncate">{preview?.siteName || 'wavlake.com'}</p>
          <p className="text-sm font-semibold text-purple-100 truncate">{preview?.title || 'Wavlake Track'}</p>
        </div>
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-xs text-purple-100 hover:bg-purple-500/20">Open track</a>
      </div>
      {preview?.description ? <p className="text-xs text-purple-200/80 line-clamp-2">{preview.description}</p> : null}
      {audio.embedUrl ? (
        <PlatformIframeEmbed title="Wavlake player" embedUrl={audio.embedUrl} sourceUrl={sourceUrl} aspect="audio" allow="autoplay; encrypted-media" compact={compact} />
      ) : playable ? (
        <audio controls preload="metadata" className="w-full"><source src={playable} /></audio>
      ) : (
        <p className="text-xs text-purple-200/70">Inline playback unavailable; use Open track.</p>
      )}
    </div>
  );
}
