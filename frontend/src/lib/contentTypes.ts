import type { FeedItem } from './social';
import { parseMediaFromFeedItem } from './media';

export type ContentType =
  | 'text'
  | 'images'
  | 'videos'
  | 'audio'
  | 'live'
  | 'longform'
  | 'events'
  | 'polls'
  | 'links';

export interface LiveStreamMeta {
  title: string;
  summary: string;
  status: 'live' | 'ended' | 'planned' | 'unknown';
  viewerCount?: number;
  totalViewers?: number;
  thumbnail?: string;
  streamUrl?: string;
  recordingUrl?: string;
  chatUrl?: string;
  host: string;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  text: 'Text posts',
  images: 'Images / photos',
  videos: 'Videos',
  audio: 'Audio / music',
  live: 'Live streams',
  longform: 'Long-form articles',
  events: 'Events',
  polls: 'Polls',
  links: 'Links / shares',
};

function tagValue(event: FeedItem, key: string): string | undefined {
  return event.tags?.find((t) => t[0] === key && t[1])?.[1];
}

function firstHttpTag(event: FeedItem, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = tagValue(event, key);
    if (value && /^https?:\/\//i.test(value)) return value;
  }
  return undefined;
}

export function detectContentTypes(event: FeedItem): Set<ContentType> {
  const media = parseMediaFromFeedItem(event);
  const out = new Set<ContentType>();
  const content = (event.content || '').toLowerCase();

  if (event.kind === 30311) out.add('live');
  if (event.kind === 30023) out.add('longform');
  if (event.kind === 31922 || event.kind === 31923) out.add('events');

  if ((event.tags || []).some((t) => t[0] === 'poll' || t[0] === 'option')) out.add('polls');
  if (/\n\s*\[\s*\]\s+|\n\s*\d+\)|\bpoll\b/.test(content) && content.includes('?')) out.add('polls');

  if (media.images.length > 0) out.add('images');
  if (media.videos.length > 0) out.add('videos');
  if (media.audios.length > 0) out.add('audio');
  if (media.links.length > 0) out.add('links');

  if (out.size === 0 && event.kind === 1) out.add('text');
  if (out.size === 0) out.add('links');

  return out;
}

export function extractLiveStreamMeta(event: FeedItem): LiveStreamMeta | null {
  if (event.kind !== 30311) return null;
  const statusRaw = (tagValue(event, 'status') || '').toLowerCase();
  const status: LiveStreamMeta['status'] =
    statusRaw === 'live' || statusRaw === 'ended' || statusRaw === 'planned'
      ? statusRaw
      : 'unknown';

  const title = tagValue(event, 'title') || 'Live stream';
  const summary = tagValue(event, 'summary') || event.content || '';
  const viewerCountRaw = tagValue(event, 'current_participants');
  const totalViewersRaw = tagValue(event, 'total_participants');

  const streamUrl = firstHttpTag(event, ['streaming', 'stream', 'url']);
  const recordingUrl = firstHttpTag(event, ['recording']);
  const chatUrl = firstHttpTag(event, ['chat', 'chat_url']);
  const thumbnail = firstHttpTag(event, ['image', 'thumb', 'picture']);

  return {
    title,
    summary,
    status,
    viewerCount: viewerCountRaw ? Number(viewerCountRaw) : undefined,
    totalViewers: totalViewersRaw ? Number(totalViewersRaw) : undefined,
    streamUrl,
    recordingUrl,
    chatUrl,
    thumbnail,
    host: event.profile?.display_name || event.profile?.name || event.profile?.nip05 || event.pubkey.slice(0, 12),
  };
}
