import type { VideoRef } from '../lib/media';

export function VimeoEmbed({ video }: { video: VideoRef }) {
  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-blue-900/70 bg-[#060a1a] shadow-[0_0_0_1px_rgba(59,130,246,0.08)]">
      <div className="relative aspect-video bg-black">
        <div className="absolute inset-0 animate-pulse bg-blue-900/15" aria-hidden="true" />
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
