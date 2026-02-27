import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ContentToken } from '../lib/media';
import { getDomain, imageLoadingMode } from '../lib/media';
import type { FeedItem } from '../lib/social';
import type { NostrProfile } from '../types';
import { QuotedEventCard } from './QuotedEventCard';
import { truncateNpub } from '../lib/nostr';
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
import { MarkdownContent } from './MarkdownContent';

const previewCache = new Map<string, LinkPreview>();

async function fetchPreview(url: string): Promise<LinkPreview> {
  if (previewCache.has(url)) return previewCache.get(url)!;
  const response = await fetch(`/api/v1/unfurl?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const fallback = { url, domain: getDomain(url) };
    previewCache.set(url, fallback);
    return fallback;
  }
  const json = (await response.json()) as LinkPreview;
  const preview = { ...json, url, domain: json.domain || getDomain(url) };
  previewCache.set(url, preview);
  return preview;
}

export function InlineContent({
  tokens,
  quotedEvents,
  quotedProfiles,
  quotedLoadingIds = new Set<string>(),
  quotedFailedIds = new Set<string>(),
}: {
  tokens: ContentToken[];
  quotedEvents: Map<string, FeedItem>;
  quotedProfiles: Map<string, NostrProfile | null>;
  quotedLoadingIds?: Set<string>;
  quotedFailedIds?: Set<string>;
}) {
  const [previews, setPreviews] = useState<Record<string, LinkPreview>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const links = [...new Set(tokens.filter((t) => t.type === 'link').map((t: any) => t.url))];
    const audioSources = [...new Set(tokens
      .filter((t) => t.type === 'audio')
      .map((t: any) => t.audio.sourceUrl || t.audio.url)
      .filter(Boolean))];
    const targets = [...new Set([...links, ...audioSources])].slice(0, 8);
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(targets.map(async (url) => [url, await fetchPreview(url)] as const));
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
  }, [tokens]);

  return (
    <div className="mt-4 space-y-3">
      {tokens.map((token, i) => {
        if (token.type === 'text') {
          const text = token.text.trim();
          if (!text) return null;
          return <MarkdownContent key={`t-${i}`} text={text} />;
        }

        if (token.type === 'profile') {
          const target = token.pubkey || token.ref;
          return (
            <Link
              key={`profile-${token.ref}-${i}`}
              to={`/profile/${target}`}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 hover:bg-cyan-500/20"
            >
              👤 {truncateNpub(token.ref, 8)}
            </Link>
          );
        }

        if (token.type === 'image') {
          const broken = imageErrors[token.url];
          if (broken) {
            return <div key={`img-err-${token.url}-${i}`} className="rounded-md border border-red-700/60 bg-red-950/20 p-3 text-xs text-red-200">Image unavailable: {token.url}</div>;
          }
          const mode = imageLoadingMode(i);
          return (
            <button key={`img-${token.url}-${i}`} type="button" className="w-full overflow-hidden rounded-md border border-cyan-900/70 bg-[#070b1d]" onClick={() => setLightbox(token.url)}>
              <img
                src={token.url}
                loading={mode}
                fetchPriority={mode === 'eager' ? 'high' : 'auto'}
                decoding="async"
                referrerPolicy="no-referrer"
                alt="Nostr post media"
                className="w-full max-h-[28rem] object-cover"
                onError={() => setImageErrors((prev) => ({ ...prev, [token.url]: true }))}
              />
            </button>
          );
        }

        if (token.type === 'video') {
          if (token.video.type === 'youtube') return <YouTubeEmbed key={`vid-${token.video.url}-${i}`} video={token.video} />;
          if (token.video.type === 'vimeo') return <VimeoEmbed key={`vid-${token.video.url}-${i}`} video={token.video} />;
          if (token.video.type !== 'direct') {
            return <PlatformIframeEmbed key={`vid-platform-${token.video.url}-${i}`} title={`${token.video.type} embed`} embedUrl={token.video.embedUrl} sourceUrl={token.video.url} aspect="video" />;
          }
          return (
            <div key={`vid-${token.video.url}-${i}`} className="overflow-hidden rounded-md border border-blue-900/70 bg-[#060a1a]">
              <video controls preload="metadata" className="w-full max-h-[26rem] bg-black"><source src={token.video.url} /></video>
            </div>
          );
        }

        if (token.type === 'audio') {
          if (token.audio.provider === 'spotify') {
            const compact = token.audio.spotifyType === 'track' || token.audio.spotifyType === 'episode';
            return <SpotifyEmbedCard key={`aud-spotify-${token.audio.url}-${i}`} audio={token.audio} compact={compact} />;
          }

          const sourceUrl = token.audio.sourceUrl || token.audio.url;
          const preview = previews[sourceUrl];
          if (token.audio.provider === 'wavlake') {
            return <WavlakeEmbedCard key={`aud-wavlake-${token.audio.url}-${i}`} audio={token.audio} preview={preview} />;
          }

          if (['soundcloud', 'appleMusic', 'bandcamp', 'mixcloud'].includes(token.audio.provider || '')) {
            return <PlatformIframeEmbed key={`aud-platform-${token.audio.url}-${i}`} title={`${token.audio.provider} player`} embedUrl={token.audio.embedUrl} sourceUrl={sourceUrl} aspect="audio" />;
          }

          const playable = token.audio.provider === 'direct' ? token.audio.url : (preview?.audio || undefined);
          const title = preview?.title || 'Audio Clip';
          return (
            <div key={`aud-${token.audio.url}-${i}`} className="rounded-md border border-purple-900/70 bg-[#0a0920] p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-purple-300">{preview?.siteName || getDomain(sourceUrl)}</p>
                  <p className="text-sm font-semibold text-purple-100">{title}</p>
                </div>
                <a href={sourceUrl} target="_blank" rel="noreferrer" className="rounded-md border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-xs text-purple-100 hover:bg-purple-500/20">Open link</a>
              </div>
              {preview?.description ? <p className="text-xs text-purple-200/80">{preview.description}</p> : null}
              {playable ? <audio controls preload="metadata" className="w-full"><source src={playable} /></audio> : <p className="text-xs text-purple-200/70">Inline playback unavailable; open the source link to play.</p>}
            </div>
          );
        }

        if (token.type === 'quote') {
          const eventId = token.eventId || token.ref;
          const event = eventId ? quotedEvents.get(eventId) : undefined;
          const profile = event ? quotedProfiles.get(event.pubkey) || undefined : undefined;
          const loadingQuote = eventId ? quotedLoadingIds.has(eventId) : false;
          const failedQuote = eventId ? quotedFailedIds.has(eventId) : !event;
          return <QuotedEventCard key={`quote-${token.ref}-${i}`} event={event} profile={profile} loading={loadingQuote && !event} unavailable={failedQuote && !event} compact />;
        }

        if (extractTweetId(token.url)) return <TwitterEmbed key={`link-twitter-${token.url}-${i}`} url={token.url} />;
        if (extractGitHubRepo(token.url)) return <GitHubRepoCard key={`link-gh-${token.url}-${i}`} url={token.url} />;
        const preview = previews[token.url];
        return <LinkPreviewCard key={`link-${token.url}-${i}`} url={token.url} preview={preview} />;
      })}

      {lightbox ? <button type="button" className="fixed inset-0 z-50 bg-black/90 p-6" onClick={() => setLightbox(null)} aria-label="Close media viewer"><img src={lightbox} alt="Expanded media" className="w-full h-full object-contain" /></button> : null}
    </div>
  );
}
