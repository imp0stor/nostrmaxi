type Props = {
  title: string;
  embedUrl?: string;
  sourceUrl: string;
  aspect?: 'video' | 'audio';
  allow?: string;
  compact?: boolean;
};

function audioEmbedHeight(title: string, compact: boolean): number {
  const normalized = title.toLowerCase();
  if (compact) return 152;
  if (normalized.includes('applemusic') || normalized.includes('bandcamp') || normalized.includes('mixcloud')) return 232;
  return 152;
}

export function PlatformIframeEmbed({ title, embedUrl, sourceUrl, aspect = 'video', allow, compact = false }: Props) {
  if (!embedUrl) return null;

  const isAudio = aspect === 'audio';
  const wrapperClass = isAudio ? 'max-w-3xl' : 'max-w-4xl';

  return (
    <div className={`w-full ${wrapperClass} overflow-hidden rounded-lg border border-purple-900/70 bg-[#0a0920] shadow-[0_0_0_1px_rgba(168,85,247,0.08)]`}>
      <div className={`relative w-full bg-black ${isAudio ? '' : 'aspect-video'}`}>
        <div className="absolute inset-0 animate-pulse bg-purple-900/15" aria-hidden="true" />
        <iframe
          src={embedUrl}
          title={title}
          loading="lazy"
          allow={allow || 'autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture; web-share'}
          allowFullScreen
          className={`relative z-10 w-full ${isAudio ? '' : 'h-full'}`}
          style={isAudio ? { height: `${audioEmbedHeight(title, compact)}px` } : undefined}
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      <div className="flex justify-end border-t border-purple-900/70 p-2">
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-xs text-purple-100 hover:bg-purple-500/20">Open source</a>
      </div>
    </div>
  );
}
