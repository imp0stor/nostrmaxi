import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';

export type Nip51ListKind = 10000 | 10001 | 30000 | 30001 | 30002 | 30003;
export type ListItemType = 'p' | 'e' | 'a' | 'r' | 't';
export type ListSyncState = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error';

export interface ListItem {
  id: string;
  type: ListItemType;
  value: string;
  relay?: string;
  marker?: string;
  order: number;
}

export interface Nip51List {
  kind: Nip51ListKind;
  dTag: string;
  title: string;
  description?: string;
  ownerPubkey: string;
  public: boolean;
  favorite?: boolean;
  items: ListItem[];
  createdAt: number;
  updatedAt: number;
  eventId?: string;
  version: number;
  syncState: ListSyncState;
  mergeStrategy: 'replace' | 'append';
  source: 'local' | 'nostr' | 'imported';
}

export interface ListTemplate {
  id: string;
  label: string;
  kind: Nip51ListKind;
  description: string;
  suggestedItems: Array<Pick<ListItem, 'type' | 'value'>>;
}

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

export const LIST_KIND_META: Record<Nip51ListKind, { label: string; replaceable: boolean; canBePublic: boolean }> = {
  10000: { label: 'Mute list', replaceable: true, canBePublic: true },
  10001: { label: 'Pin list', replaceable: true, canBePublic: true },
  30000: { label: 'Follow set', replaceable: true, canBePublic: true },
  30001: { label: 'Generic list', replaceable: true, canBePublic: true },
  30002: { label: 'Relay set', replaceable: true, canBePublic: true },
  30003: { label: 'Bookmark set', replaceable: true, canBePublic: true },
};

export const LIST_TEMPLATES: ListTemplate[] = [
  { id: 'default-mutes', label: 'Spam Mutes', kind: 10000, description: 'Mute known spam accounts.', suggestedItems: [] },
  { id: 'relay-set', label: 'High Uptime Relays', kind: 30002, description: 'Reliable relays for reading/writing.', suggestedItems: [
    { type: 'r', value: 'wss://relay.damus.io' },
    { type: 'r', value: 'wss://nos.lol' },
  ] },
  { id: 'bookmarks', label: 'Research Bookmarks', kind: 30003, description: 'Save events/articles for later.', suggestedItems: [] },
  { id: 'follows-bitcoin', label: 'Bitcoin Follow Set', kind: 30000, description: 'Topic-focused follows.', suggestedItems: [] },
];

export function slugifyListName(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return base || `list-${Math.floor(Date.now() / 1000)}`;
}

export function buildListShareUrl(ownerPubkey: string, dTag: string): string {
  if (typeof window === 'undefined') return `nostrmaxi://lists/${ownerPubkey}/${dTag}`;
  const url = new URL(window.location.origin);
  url.pathname = `/lists/${ownerPubkey}/${dTag}`;
  return url.toString();
}

export function createDraftList(input: {
  kind: Nip51ListKind;
  title: string;
  ownerPubkey: string;
  dTag?: string;
  description?: string;
  mergeStrategy?: 'replace' | 'append';
}): Nip51List {
  const dTag = input.dTag?.trim() || slugifyListName(input.title);
  const now = Math.floor(Date.now() / 1000);
  return {
    kind: input.kind,
    dTag,
    title: input.title.trim() || LIST_KIND_META[input.kind].label,
    description: input.description?.trim() || '',
    ownerPubkey: input.ownerPubkey,
    public: true,
    items: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
    syncState: 'idle',
    mergeStrategy: input.mergeStrategy || 'replace',
    source: 'local',
  };
}

export function reorderListItems(items: ListItem[], fromIndex: number, toIndex: number): ListItem[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, order: index }));
}

function listItemFromTag(tag: string[], order: number): ListItem | null {
  if (!tag?.[0] || !tag[1]) return null;
  const type = tag[0] as ListItemType;
  if (!['p', 'e', 'a', 'r', 't'].includes(type)) return null;
  return {
    id: `${type}:${tag[1]}:${order}`,
    type,
    value: tag[1],
    relay: tag[2],
    marker: tag[3],
    order,
  };
}

export function parseNip51Event(event: NostrEvent): Nip51List | null {
  if (![10000, 10001, 30000, 30001, 30002, 30003].includes(event.kind)) return null;
  const dTag = event.tags.find((t) => t[0] === 'd')?.[1] || slugifyListName(`${event.kind}-${event.pubkey}`);
  const title = event.tags.find((t) => t[0] === 'title')?.[1]
    || event.tags.find((t) => t[0] === 'name')?.[1]
    || dTag;
  const description = event.tags.find((t) => t[0] === 'description')?.[1] || '';
  const versionTag = Number(event.tags.find((t) => t[0] === 'version')?.[1] || 1);
  const mergeStrategy = (event.tags.find((t) => t[0] === 'merge')?.[1] === 'append' ? 'append' : 'replace');

  const items = event.tags
    .map((tag, idx) => listItemFromTag(tag, idx))
    .filter((item): item is ListItem => Boolean(item))
    .map((item, order) => ({ ...item, order }));

  return {
    kind: event.kind as Nip51ListKind,
    dTag,
    title,
    description,
    ownerPubkey: event.pubkey,
    public: true,
    favorite: event.tags.some((t) => t[0] === 'favorite' && t[1] === '1'),
    items,
    createdAt: event.created_at,
    updatedAt: event.created_at,
    eventId: event.id,
    version: Number.isFinite(versionTag) ? versionTag : 1,
    syncState: 'synced',
    mergeStrategy,
    source: 'nostr',
  };
}

export function dedupeReplaceableLists(events: NostrEvent[]): Nip51List[] {
  const byKey = new Map<string, NostrEvent>();
  for (const evt of events) {
    const parsed = parseNip51Event(evt);
    if (!parsed) continue;
    const key = `${parsed.ownerPubkey}:${parsed.kind}:${parsed.dTag}`;
    const prev = byKey.get(key);
    if (!prev || evt.created_at > prev.created_at) byKey.set(key, evt);
  }
  return Array.from(byKey.values())
    .map((evt) => parseNip51Event(evt))
    .filter((x): x is Nip51List => Boolean(x));
}

export function mergeListVersions(local: Nip51List, remote: Nip51List): Nip51List {
  if (remote.updatedAt > local.updatedAt && remote.version >= local.version) {
    return { ...remote, syncState: 'synced' };
  }

  if (local.updatedAt > remote.updatedAt && local.version > remote.version) {
    return { ...local, syncState: 'conflict' };
  }

  if (local.mergeStrategy === 'append') {
    const mergedItems = [...local.items];
    const seen = new Set(local.items.map((item) => `${item.type}:${item.value}`));
    for (const item of remote.items) {
      const key = `${item.type}:${item.value}`;
      if (!seen.has(key)) mergedItems.push({ ...item, order: mergedItems.length });
    }
    return { ...local, items: mergedItems, syncState: 'conflict' };
  }

  return { ...remote, syncState: 'synced' };
}

export function listToEventPayload(list: Nip51List): Omit<NostrEvent, 'id' | 'sig'> {
  return {
    kind: list.kind,
    pubkey: list.ownerPubkey,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['d', list.dTag],
      ['title', list.title],
      ...(list.description ? [['description', list.description]] : []),
      ['version', String(list.version)],
      ['merge', list.mergeStrategy],
      ...(list.favorite ? [['favorite', '1']] : []),
      ...list.items.map((item) => [item.type, item.value, item.relay || '', item.marker || ''] as string[]),
    ],
  };
}

export async function loadMyNip51Lists(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<Nip51List[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, { kinds: [10000, 10001, 30000, 30001, 30002, 30003], authors: [pubkey], limit: 500 });
    return dedupeReplaceableLists(events as NostrEvent[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    pool.close(relays);
  }
}

export async function discoverPublicNip51Lists(relays: string[] = DEFAULT_RELAYS): Promise<Nip51List[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, { kinds: [30000, 30001, 30002, 30003], limit: 800 });
    return dedupeReplaceableLists(events as NostrEvent[])
      .filter((list) => list.items.length > 0)
      .slice(0, 200);
  } finally {
    pool.close(relays);
  }
}

export function exportListJson(list: Nip51List): string {
  return JSON.stringify(list, null, 2);
}

export function importListJson(raw: string, ownerPubkey: string): Nip51List {
  const parsed = JSON.parse(raw) as Partial<Nip51List>;
  const base = createDraftList({
    kind: (parsed.kind || 30001) as Nip51ListKind,
    title: parsed.title || 'Imported list',
    ownerPubkey,
    dTag: parsed.dTag || slugifyListName(parsed.title || 'imported-list'),
    description: parsed.description,
    mergeStrategy: parsed.mergeStrategy,
  });

  const items = (parsed.items || [])
    .filter((item) => item?.value && item?.type)
    .map((item, index) => ({
      id: item.id || `${item.type}:${item.value}:${index}`,
      type: item.type as ListItemType,
      value: item.value,
      relay: item.relay,
      marker: item.marker,
      order: index,
    }));

  return {
    ...base,
    title: parsed.title || base.title,
    dTag: parsed.dTag || base.dTag,
    description: parsed.description || '',
    items,
    version: Math.max(1, Number(parsed.version || 1)),
    source: 'imported',
  };
}
