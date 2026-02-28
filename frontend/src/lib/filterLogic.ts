export type FilterLogic = 'and' | 'or' | 'all' | 'any' | 'not';

export interface TagFilter {
  tags: string[];
  logic: FilterLogic;
  exclude?: string[];
}

export interface FilterConfig {
  tags: TagFilter;
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
}

export interface NostrEventLike {
  pubkey?: string;
  kind?: number;
  created_at?: number;
  tags?: string[][];
}

const normalize = (value: string): string => value.trim().toLowerCase();

export function extractEventTags(event: NostrEventLike): string[] {
  return (event.tags || [])
    .filter((tag) => tag[0] === 't' && typeof tag[1] === 'string' && tag[1].trim())
    .map((tag) => normalize(tag[1]));
}

export function matchesTagFilter(eventTags: string[], tagFilter: TagFilter): boolean {
  const selected = tagFilter.tags.map(normalize).filter(Boolean);
  const excludes = (tagFilter.exclude || []).map(normalize).filter(Boolean);
  const tagSet = new Set(eventTags.map(normalize));

  if (excludes.some((tag) => tagSet.has(tag))) return false;
  if (selected.length === 0) return true;

  if (tagFilter.logic === 'and' || tagFilter.logic === 'all') {
    return selected.every((tag) => tagSet.has(tag));
  }

  if (tagFilter.logic === 'not') {
    return selected.every((tag) => !tagSet.has(tag));
  }

  return selected.some((tag) => tagSet.has(tag));
}

export function matchesFilter(event: NostrEventLike, filter: FilterConfig): boolean {
  const eventTags = extractEventTags(event);

  if (!matchesTagFilter(eventTags, filter.tags)) return false;
  if (filter.authors && filter.authors.length > 0 && event.pubkey && !filter.authors.includes(event.pubkey)) return false;
  if (filter.kinds && filter.kinds.length > 0 && typeof event.kind === 'number' && !filter.kinds.includes(event.kind)) return false;
  if (typeof filter.since === 'number' && typeof event.created_at === 'number' && event.created_at < filter.since) return false;
  if (typeof filter.until === 'number' && typeof event.created_at === 'number' && event.created_at > filter.until) return false;

  return true;
}
