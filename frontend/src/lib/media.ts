import { nip19 } from 'nostr-tools';
import type { FeedItem } from './social';

export interface ParsedMedia {
  text: string;
  images: string[];
  videos: VideoRef[];
  links: string[];
  audios: AudioRef[];
  tokens: ContentToken[];
}

export interface VideoRef {
  url: string;
  type: 'youtube' | 'vimeo' | 'direct';
  embedUrl?: string;
  thumbnail?: string;
}

export interface AudioRef {
  url: string;
  sourceUrl?: string;
  provider?: 'direct' | 'wavlake' | 'spotify';
  trackId?: string;
  spotifyType?: 'track' | 'album' | 'episode' | 'playlist' | 'show';
  spotifyId?: string;
  embedUrl?: string;
}

export type ContentToken =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string }
  | { type: 'video'; video: VideoRef }
  | { type: 'audio'; audio: AudioRef }
  | { type: 'link'; url: string }
  | { type: 'quote'; ref: string; eventId?: string; raw: string }
  | { type: 'profile'; ref: string; pubkey?: string; raw: string };

const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|flac|opus|oga)(\?.*)?$/i;
const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi;
const NOSTR_REF_RE = /(?:nostr:)?(note1[0-9a-z]+|nevent1[0-9a-z]+|npub1[0-9a-z]+|nprofile1[0-9a-z]+)/gi;
const INLINE_RE = /((?:nostr:)?(?:note1|nevent1|npub1|nprofile1)[0-9a-z]+|https?:\/\/[^\s<>()]+[^\s<>().,!?])/gi;

function unique<T>(arr: T[]): T[] { return [...new Set(arr)]; }

function normalizeUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch { return null; }
}

function decodeRef(rawRef: string): { type: 'quote' | 'profile' | 'unknown'; ref: string; eventId?: string; pubkey?: string } {
  const ref = rawRef.replace(/^nostr:/i, '');
  try {
    const decoded = nip19.decode(ref);
    if (decoded.type === 'note') return { type: 'quote', ref, eventId: decoded.data as string };
    if (decoded.type === 'nevent') {
      const d = decoded.data as any;
      return { type: 'quote', ref, eventId: d?.id };
    }
    if (decoded.type === 'npub') return { type: 'profile', ref, pubkey: decoded.data as string };
    if (decoded.type === 'nprofile') {
      const d = decoded.data as any;
      return { type: 'profile', ref, pubkey: d?.pubkey };
    }
  } catch {
    // fallback
  }
  if (/^(note1|nevent1)/i.test(ref)) return { type: 'quote', ref };
  if (/^(npub1|nprofile1)/i.test(ref)) return { type: 'profile', ref };
  return { type: 'unknown', ref };
}

function toVideoRef(url: string): VideoRef | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const id = host.includes('youtu.be') ? u.pathname.replace('/', '') : (u.searchParams.get('v') || '');
      if (!id) return null;
      return { url: normalized, type: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}`, thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg` };
    }
    if (host.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean).pop();
      if (!id || !/^\d+$/.test(id)) return null;
      return { url: normalized, type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
    }
    if (VIDEO_EXT.test(u.pathname)) return { url: normalized, type: 'direct' };
    return null;
  } catch { return null; }
}

function toAudioRef(url: string): AudioRef | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;

  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');

    if (AUDIO_EXT.test(u.pathname)) {
      return { url: normalized, sourceUrl: normalized, provider: 'direct' };
    }

    if (host === 'wavlake.com') {
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === 'track' && parts[1]) {
        const canonicalUrl = `https://wavlake.com/track/${parts[1]}`;
        return { url: canonicalUrl, sourceUrl: normalized, provider: 'wavlake', trackId: parts[1] };
      }
    }

    if (host === 'open.spotify.com') {
      const parts = path.split('/').filter(Boolean);
      const kind = parts[0];
      const id = parts[1];
      if (id && ['track', 'album', 'episode', 'playlist', 'show'].includes(kind)) {
        const canonicalUrl = `https://open.spotify.com/${kind}/${id}`;
        return {
          url: canonicalUrl,
          sourceUrl: normalized,
          provider: 'spotify',
          spotifyType: kind as AudioRef['spotifyType'],
          spotifyId: id,
          embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

type ImetaUrl = { url: string; mime: string | undefined };
function parseImetaTag(tag: string[]): ImetaUrl[] {
  if (tag[0] !== 'imeta') return [];
  let mime: string | undefined;
  for (const entry of tag.slice(1)) {
    const m = entry.match(/(?:^|\s)m\s+([^\s]+)/i);
    if (m?.[1]) mime = m[1].toLowerCase();
  }
  const result: ImetaUrl[] = [];
  for (const entry of tag.slice(1)) {
    const match = entry.match(/(?:^|\s)url\s+(https?:\/\/\S+)/i);
    if (match?.[1]) result.push({ url: match[1], mime });
  }
  return result;
}

export function imageLoadingMode(index: number): 'eager' | 'lazy' { return index < 2 ? 'eager' : 'lazy'; }

function classifyUrl(url: string): ContentToken {
  const video = toVideoRef(url);
  if (video) return { type: 'video', video };

  const audio = toAudioRef(url);
  if (audio) return { type: 'audio', audio };

  try {
    const pathname = new URL(url).pathname;
    if (IMAGE_EXT.test(pathname)) return { type: 'image', url };
  } catch { /* noop */ }
  return { type: 'link', url };
}

function parseInlineTokens(content: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  const seenEmbedUrls = new Set<string>();
  const seenQuoteRefs = new Set<string>();
  const seenProfileRefs = new Set<string>();

  let cursor = 0;
  INLINE_RE.lastIndex = 0;
  for (const match of content.matchAll(INLINE_RE)) {
    const raw = match[0];
    const idx = match.index ?? 0;

    if (idx > cursor) tokens.push({ type: 'text', text: content.slice(cursor, idx) });

    if (/^(?:nostr:)?(?:note1|nevent1|npub1|nprofile1)/i.test(raw)) {
      const decoded = decodeRef(raw);
      if (decoded.type === 'quote') {
        if (!seenQuoteRefs.has(decoded.ref)) {
          tokens.push({ type: 'quote', ref: decoded.ref, eventId: decoded.eventId, raw });
          seenQuoteRefs.add(decoded.ref);
        }
      } else if (decoded.type === 'profile') {
        if (!seenProfileRefs.has(decoded.ref)) {
          tokens.push({ type: 'profile', ref: decoded.ref, pubkey: decoded.pubkey, raw });
          seenProfileRefs.add(decoded.ref);
        }
      } else {
        tokens.push({ type: 'text', text: raw });
      }
    } else {
      const normalized = normalizeUrl(raw);
      if (normalized && !seenEmbedUrls.has(normalized)) {
        tokens.push(classifyUrl(normalized));
        seenEmbedUrls.add(normalized);
      }
    }

    cursor = idx + raw.length;
  }

  if (cursor < content.length) tokens.push({ type: 'text', text: content.slice(cursor) });
  return tokens;
}

function appendTagOnlyTokens(item: FeedItem, tokens: ContentToken[]): ContentToken[] {
  const out = [...tokens];
  const presentUrls = new Set(out
    .filter((t) => t.type === 'image' || t.type === 'link')
    .map((t: any) => t.url)
    .concat(out.filter((t) => t.type === 'audio').map((t: any) => t.audio.url))
    .concat(out.filter((t) => t.type === 'video').map((t: any) => t.video.url)));
  const presentQuoteIds = new Set(out.filter((t) => t.type === 'quote').map((t: any) => t.eventId).filter(Boolean));

  for (const entry of (item.tags || []).flatMap((tag) => parseImetaTag(tag))) {
    const normalized = normalizeUrl(entry.url);
    if (!normalized || presentUrls.has(normalized)) continue;
    let token: ContentToken;
    if (entry.mime?.startsWith('image/')) token = { type: 'image', url: normalized };
    else if (entry.mime?.startsWith('video/')) token = toVideoRef(normalized) ? { type: 'video', video: toVideoRef(normalized)! } : { type: 'link', url: normalized };
    else if (entry.mime?.startsWith('audio/')) token = { type: 'audio', audio: { url: normalized, sourceUrl: normalized, provider: 'direct' } };
    else token = classifyUrl(normalized);
    out.push(token);
    presentUrls.add(normalized);
  }

  for (const tag of item.tags || []) {
    if (tag[0] !== 'e' || !tag[1] || presentQuoteIds.has(tag[1])) continue;
    out.push({ type: 'quote', ref: tag[1], eventId: tag[1], raw: tag[1] });
    presentQuoteIds.add(tag[1]);
  }

  return out;
}

export function parseMediaFromFeedItem(item: FeedItem): ParsedMedia {
  const markdownImages = Array.from(item.content.matchAll(MARKDOWN_IMAGE_RE)).map((m) => m[1]);
  const contentSansMarkdown = item.content.replace(MARKDOWN_IMAGE_RE, '');

  let tokens = parseInlineTokens(contentSansMarkdown);
  for (const url of markdownImages.map((u) => normalizeUrl(u)).filter((u): u is string => Boolean(u))) {
    if (!tokens.some((t) => (t.type === 'image' && t.url === url) || (t.type === 'video' && t.video.url === url) || (t.type === 'link' && t.url === url))) {
      tokens.push({ type: 'image', url });
    }
  }

  tokens = appendTagOnlyTokens(item, tokens);

  const images = unique(tokens.filter((t) => t.type === 'image').map((t: any) => t.url));
  const videos = unique(tokens.filter((t) => t.type === 'video').map((t: any) => t.video.url)).map((url) => toVideoRef(url)).filter((v): v is VideoRef => Boolean(v));
  const links = unique(tokens.filter((t) => t.type === 'link').map((t: any) => t.url));
  const audios = unique(tokens.filter((t) => t.type === 'audio').map((t: any) => t.audio.url)).map((url) => toAudioRef(url) || { url, sourceUrl: url, provider: 'direct' as const });
  const text = tokens.filter((t) => t.type === 'text').map((t: any) => t.text).join('').trim();

  return { text, images, videos, links, audios, tokens };
}

export function extractQuoteRefsFromTokens(tokens: ContentToken[]): string[] {
  return unique(tokens.filter((t) => t.type === 'quote').map((t: any) => t.eventId || t.ref).filter(Boolean));
}

export function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function parseNostrReferences(content: string): string[] {
  const refs = new Set<string>();
  for (const match of content.matchAll(NOSTR_REF_RE)) {
    const decoded = decodeRef(match[0]);
    if (decoded.eventId) refs.add(decoded.eventId);
  }
  return [...refs];
}
