import type { VideoRef } from '../lib/media';

export function VimeoEmbed({ video }: { video: VideoRef }) {
  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-neutral-800 bg-[#0a0a0a] shadow-[0_0_0_1px_rgba(249,115,22,0.12)]">
      <div className="relative aspect-video bg-black">
        <div className="absolute inset-0 animate-pulse bg-orange-500/10" aria-hidden="true" />
        <iframe
          src={video.embedUrl}
          title="Vimeo video"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="relative z-10 h-full w-full"
        />
      </div>
    </div>
  );
}
