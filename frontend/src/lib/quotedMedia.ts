import type { NostrEvent } from '../types';
import type { AudioRef } from './media';
import { parseMediaFromFeedItem } from './media';

export interface QuotedRenderModel {
  text: string;
  images: string[];
  videos: Array<{ url: string; type: 'youtube' | 'vimeo' | 'twitch' | 'rumble' | 'odysee' | 'instagram' | 'tiktok' | 'direct'; embedUrl?: string; thumbnail?: string }>;
  audios: AudioRef[];
  links: string[];
}

export function quotedRenderModel(event: NostrEvent): QuotedRenderModel {
  const parsed = parseMediaFromFeedItem(event as any);
  return {
    text: parsed.text,
    images: parsed.images,
    videos: parsed.videos,
    audios: parsed.audios,
    links: parsed.links,
  };
}
