import { SimplePool, finalizeEvent, getPublicKey, nip44, type Event as NostrEvent } from 'nostr-tools';

const FILTER_KIND = 30001;
const FILTER_D_TAG = 'content-filters';
const STORAGE_PREFIX = 'nostrmaxi.contentFilters';
const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

export interface ContentFilters {
  mutedWords: string[];
  mutedPubkeys: string[];
  mutedThreads: string[];
  mutedHashtags: string[];
}

export const DEFAULT_CONTENT_FILTERS: ContentFilters = {
  mutedWords: [],
  mutedPubkeys: [],
  mutedThreads: [],
  mutedHashtags: [],
};

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function normalize(filters: Partial<ContentFilters>): ContentFilters {
  return {
    mutedWords: uniq((filters.mutedWords || []).map((w) => w.toLowerCase())),
    mutedPubkeys: uniq(filters.mutedPubkeys || []),
    mutedThreads: uniq(filters.mutedThreads || []),
    mutedHashtags: uniq((filters.mutedHashtags || []).map((h) => h.replace(/^#/, '').toLowerCase())),
  };
}

function extractHashtags(event: NostrEvent): string[] {
  const fromTags = (event.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1].toLowerCase());
  const fromContent = Array.from((event.content || '').matchAll(/#([a-z0-9_]+)/gi)).map((m) => m[1].toLowerCase());
  return uniq([...fromTags, ...fromContent]);
}

function extractThreadIds(event: NostrEvent): string[] {
  const refs = (event.tags || []).filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]);
  return uniq(refs);
}

export function shouldFilter(event: NostrEvent, filters: ContentFilters): boolean {
  const normalized = normalize(filters);

  if (normalized.mutedPubkeys.includes(event.pubkey)) return true;
  if (normalized.mutedThreads.includes(event.id)) return true;

  const threadRefs = extractThreadIds(event);
  if (threadRefs.some((id) => normalized.mutedThreads.includes(id))) return true;

  const hashtags = extractHashtags(event);
  if (hashtags.some((tag) => normalized.mutedHashtags.includes(tag))) return true;

  const content = (event.content || '').toLowerCase();
  if (normalized.mutedWords.some((word) => content.includes(word))) return true;

  return false;
}

export function applyContentFilters<T extends NostrEvent>(events: T[], filters: ContentFilters): T[] {
  const normalized = normalize(filters);
  if (
    normalized.mutedWords.length === 0 &&
    normalized.mutedPubkeys.length === 0 &&
    normalized.mutedThreads.length === 0 &&
    normalized.mutedHashtags.length === 0
  ) return events;

  return events.filter((event) => !shouldFilter(event, normalized));
}

function contentFilterStorageKey(pubkey?: string): string {
  return `${STORAGE_PREFIX}:${pubkey || 'anon'}`;
}

export function loadLocalFilters(pubkey?: string): ContentFilters {
  if (typeof window === 'undefined') return DEFAULT_CONTENT_FILTERS;
  try {
    const raw = window.localStorage.getItem(contentFilterStorageKey(pubkey));
    if (!raw) return DEFAULT_CONTENT_FILTERS;
    const parsed = JSON.parse(raw) as Partial<ContentFilters>;
    return normalize(parsed);
  } catch {
    return DEFAULT_CONTENT_FILTERS;
  }
}

export function saveLocalFilters(filters: ContentFilters, pubkey?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(contentFilterStorageKey(pubkey), JSON.stringify(normalize(filters)));
}

function getConversationKey(privateKey: Uint8Array): Uint8Array {
  const pubkey = getPublicKey(privateKey);
  return nip44.v2.utils.getConversationKey(privateKey, pubkey);
}

export async function loadFilters(pubkey: string, privateKey: Uint8Array, relays: string[] = DEFAULT_RELAYS): Promise<ContentFilters> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, {
      kinds: [FILTER_KIND],
      authors: [pubkey],
      '#d': [FILTER_D_TAG],
      limit: 20,
    } as any);

    const latest = [...(events as NostrEvent[])].sort((a, b) => b.created_at - a.created_at)[0];
    if (!latest) return { ...DEFAULT_CONTENT_FILTERS };

    const encryptedTag = latest.tags.find((t) => t[0] === 'encrypted' && t[1] === 'nip44');
    if (!encryptedTag) {
      const legacy = JSON.parse(latest.content || '{}') as Partial<ContentFilters>;
      return normalize({ ...DEFAULT_CONTENT_FILTERS, ...legacy });
    }

    const conversationKey = getConversationKey(privateKey);
    const plaintext = nip44.v2.decrypt(latest.content, conversationKey);
    const parsed = JSON.parse(plaintext) as Partial<ContentFilters>;
    return normalize({ ...DEFAULT_CONTENT_FILTERS, ...parsed });
  } finally {
    pool.close(relays);
  }
}

export async function saveFilters(filters: ContentFilters, privateKey: Uint8Array, relays: string[] = DEFAULT_RELAYS): Promise<void> {
  const normalized = normalize(filters);
  const pubkey = getPublicKey(privateKey);
  const conversationKey = getConversationKey(privateKey);
  const encryptedContent = nip44.v2.encrypt(JSON.stringify(normalized), conversationKey);

  const unsigned = {
    kind: FILTER_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', FILTER_D_TAG],
      ['encrypted', 'nip44'],
    ],
    content: encryptedContent,
  };

  const signed = finalizeEvent(unsigned, privateKey);
  const pool = new SimplePool();
  try {
    const pubs = pool.publish(relays, signed as any);
    await Promise.all(pubs as any);
  } finally {
    pool.close(relays);
  }
}
