import { useEffect, useMemo, useState } from 'react';
import type { AudioRef, VideoRef } from '../lib/media';
import { getDomain, imageLoadingMode } from '../lib/media';
import { isGifUrl } from '../lib/mediaDetection';
import { SpotifyEmbedCard } from './SpotifyEmbedCard';
import { YouTubeEmbed } from './YouTubeEmbed';
import { VimeoEmbed } from './VimeoEmbed';
import { LinkPreviewCard } from './LinkPreviewCard';
import { TwitterEmbed } from './TwitterEmbed';
import { GitHubRepoCard } from './GitHubRepoCard';
import { WavlakeEmbedCard } from './WavlakeEmbedCard';
import { PlatformIframeEmbed } from './PlatformIframeEmbed';
import type { LinkPreview } from '../lib/richEmbeds';
import { extractGitHubRepo, extractTweetId } from '../lib/richEmbeds';

const previewCache = new Map<string, LinkPreview>();

type ImageMeta = { width: number; height: number };

function getImageSizingClass(meta?: ImageMeta): string {
  const classes = [
    'block',
    'mx-auto',
    'max-w-full',
    'w-full',
    'h-auto',
    'max-h-[500px]',
    'object-contain',
    'object-center',
    'bg-black/20',
  ];

  if (meta) {
    const ratio = meta.width / Math.max(meta.height, 1);
    const isVerySmall = meta.width < 120 || meta.height < 120;
    const isVeryWide = ratio > 3;

    if (isVerySmall) classes.push('min-h-24');
    if (isVeryWide) classes.push('sm:max-w-[56rem]');
  }

  return classes.join(' ');
}

async function fetchPreview(url: string): Promise<LinkPreview> {
  if (previewCache.has(url)) return previewCache.get(url)!;

  const response = await fetch(`/api/v1/unfurl?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const fallback = { url, domain: getDomain(url) };
    previewCache.set(url, fallback);
    return fallback;
  }

  const json = (await response.json()) as LinkPreview;
  const preview: LinkPreview = {
    url,
    title: json.title,
    description: json.description,
    image: json.image,
    audio: json.audio,
    siteName: json.siteName,
    domain: json.domain || getDomain(url),
  };
  previewCache.set(url, preview);
  return preview;
}

function MediaImage({ src, index, onClick }: { src: string; index: number; onClick: (src: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [meta, setMeta] = useState<ImageMeta | undefined>();
  const isGif = isGifUrl(src);

  return (
    <div className="relative flex w-full items-center justify-center overflow-hidden border border-cyan-900/70 bg-[#070b1d] hover:border-cyan-300/80 transition-colors rounded-md">
      {!loaded && !failed ? (
        <div className="h-56 animate-pulse bg-cyan-900/20 flex items-center justify-center">
          {isGif ? <span className="text-xs text-cyan-400/60">Loading GIF...</span> : null}
        </div>
      ) : null}
      {failed ? (
        <div className="h-40 grid place-items-center text-sm text-red-300 p-3 text-center gap-2">
          <span>Image failed to load</span>
          <div className="flex gap-2">
            <button type="button" className="cy-chip" onClick={() => { setFailed(false); setLoaded(false); setRetryKey((k) => k + 1); }}>Retry</button>
            <a className="cy-chip" href={src} target="_blank" rel="noreferrer">Open</a>
          </div>
        </div>
      ) : null}
      {isGif && loaded ? (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-cyan-300 backdrop-blur-sm">
          GIF
        </div>
      ) : null}
      <button type="button" className="w-full" onClick={() => onClick(src)} aria-label={`Open ${isGif ? 'GIF' : 'image'} ${index + 1}`}>
        <img
          key={`${src}-${retryKey}`}
          src={src}
          loading={imageLoadingMode(index)}
          fetchPriority={imageLoadingMode(index) === 'eager' ? 'high' : 'auto'}
          decoding="async"
          referrerPolicy="no-referrer"
          alt={isGif ? 'Animated GIF' : 'Nostr post media'}
          className={`${getImageSizingClass(meta)} ${loaded ? 'block' : 'hidden'}`}
          onLoad={(event) => {
            const target = event.currentTarget;
            setMeta({ width: target.naturalWidth, height: target.naturalHeight });
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      </button>
    </div>
  );
}

export function RichMedia({ images, videos, audios = [], links, compact = false }: { images: string[]; videos: VideoRef[]; audios?: AudioRef[]; links: string[]; compact?: boolean }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, LinkPreview>>({});

  const previewTargets = useMemo(() => {
    const audioSources = audios.map((a) => a.sourceUrl || a.url);
    return [...new Set([...links.slice(0, 4), ...audioSources])].slice(0, 8);
  }, [links, audios]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(previewTargets.map(async (url) => [url, await fetchPreview(url)] as const));
      if (cancelled) return;
      setPreviews((prev) => {
        const next = { ...prev };
        for (const [url, data] of entries) next[url] = data;
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [previewTargets]);

  return (
    <div className="mt-4 space-y-3">
      {images.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {images.map((src, i) => (
            <MediaImage key={`${src}-${i}`} src={src} index={i} onClick={setLightbox} />
          ))}
        </div>
      ) : null}

      {videos.map((video, i) => {
        if (video.type === 'youtube') return <YouTubeEmbed key={`${video.url}-${i}`} video={video} />;
        if (video.type === 'vimeo') return <VimeoEmbed key={`${video.url}-${i}`} video={video} />;
        if (video.type !== 'direct') return <PlatformIframeEmbed key={`${video.url}-${i}`} title={`${video.type} embed`} embedUrl={video.embedUrl} sourceUrl={video.url} aspect="video" />;
        return (
          <div key={`${video.url}-${i}`} className="rounded-md border border-neutral-800 bg-[#0a0a0a] overflow-hidden">
            <video controls preload="metadata" className="w-full max-h-[30rem] bg-black" poster={video.thumbnail}>
              <source src={video.url} />
            </video>
          </div>
        );
      })}

      {audios.map((audio, i) => {
        if (audio.provider === 'spotify') {
          const spotifyCompact = compact || audio.spotifyType === 'track' || audio.spotifyType === 'episode';
          return <SpotifyEmbedCard key={`aud-spotify-${audio.url}-${i}`} audio={audio} compact={spotifyCompact} />;
        }

        const sourceUrl = audio.sourceUrl || audio.url;
        const preview = previews[sourceUrl];

        if (audio.provider === 'wavlake') {
          return <WavlakeEmbedCard key={`aud-wavlake-${audio.url}-${i}`} audio={audio} preview={preview} compact={compact} />;
        }

        if (['soundcloud', 'appleMusic', 'bandcamp', 'mixcloud'].includes(audio.provider || '')) {
          return <PlatformIframeEmbed key={`aud-platform-${audio.url}-${i}`} title={`${audio.provider} player`} embedUrl={audio.embedUrl} sourceUrl={sourceUrl} aspect="audio" compact={compact} />;
        }

        return (
          <div key={`${audio.url}-${i}`} className="rounded-md border border-purple-900/70 bg-[#0a0920] p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-purple-300">{preview?.siteName || getDomain(sourceUrl)}</p>
                <p className="text-sm font-semibold text-purple-100">{preview?.title || 'Audio Clip'}</p>
              </div>
              <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-xs text-purple-100 hover:bg-purple-500/20">Open link</a>
            </div>
            {preview?.description ? <p className="text-xs text-purple-200/80">{preview.description}</p> : null}
            <audio controls preload="metadata" className="w-full"><source src={audio.url} /></audio>
          </div>
        );
      })}

      {links.slice(0, 4).map((url) => {
        if (extractTweetId(url)) return <TwitterEmbed key={`link-twitter-${url}`} url={url} />;
        if (extractGitHubRepo(url)) return <GitHubRepoCard key={`link-gh-${url}`} url={url} />;
        const preview = previews[url] || { url, domain: getDomain(url) };
        return <LinkPreviewCard key={url} preview={preview} />;
      })}

      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/90 p-6"
          onClick={() => setLightbox(null)}
          aria-label="Close media viewer"
        >
          <img src={lightbox} alt="Expanded media" className="w-full h-full object-contain" />
        </button>
      ) : null}
    </div>
  );
}
