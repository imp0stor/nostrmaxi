export interface CatalogFilterableEntry {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  pricing: string;
  trustScore: number;
  rankingScore: number;
  tags: string[];
}

export interface CatalogFilters {
  search: string;
  category: string;
  pricing: string;
  tag: string;
  minTrust: number;
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  search: '',
  category: '',
  pricing: '',
  tag: '',
  minTrust: 0,
};

export function applyCatalogFilters<T extends CatalogFilterableEntry>(entries: T[], filters: CatalogFilters): T[] {
  const searchLower = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.pricing && entry.pricing !== filters.pricing) return false;
    if (filters.tag && !entry.tags.includes(filters.tag)) return false;
    if (entry.trustScore < filters.minTrust) return false;

    if (!searchLower) return true;
    const haystack = `${entry.name} ${entry.description} ${entry.tags.join(' ')} ${entry.subcategory}`.toLowerCase();
    return haystack.includes(searchLower);
  });
}

export function groupByCategory<T extends CatalogFilterableEntry>(entries: T[]): Array<{ category: string; entries: T[] }> {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    if (!grouped.has(entry.category)) grouped.set(entry.category, []);
    grouped.get(entry.category)?.push(entry);
  }

  return [...grouped.entries()]
    .map(([category, items]) => ({
      category,
      entries: [...items].sort((a, b) => b.rankingScore - a.rankingScore),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export function getActiveCatalogFilterCount(filters: CatalogFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.category) count += 1;
  if (filters.pricing) count += 1;
  if (filters.tag) count += 1;
  if (filters.minTrust > DEFAULT_CATALOG_FILTERS.minTrust) count += 1;
  return count;
}

export function getCatalogFilterSummary(filters: CatalogFilters): string[] {
  const summary: string[] = [];
  if (filters.search.trim()) summary.push(`Search: "${filters.search.trim()}"`);
  summary.push(filters.category ? `Category: ${filters.category}` : 'Category: all');
  summary.push(filters.pricing ? `Pricing: ${filters.pricing}` : 'Pricing: any');
  summary.push(filters.tag ? `Tag: #${filters.tag}` : 'Tag: any');
  summary.push(filters.minTrust > 0 ? `Min trust: ${filters.minTrust}+` : 'Min trust: 0+');
  return summary;
}

const KEYBOARD_NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']);

export function nextCatalogEntryIdForKey<T extends { id: string }>(
  entries: T[],
  activeId: string,
  key: string,
): string {
  if (!entries.length || !KEYBOARD_NAV_KEYS.has(key)) return activeId;

  const currentIndex = Math.max(0, entries.findIndex((entry) => entry.id === activeId));
  const jump = Math.max(1, Math.ceil(entries.length / 6));

  switch (key) {
    case 'Home':
      return entries[0].id;
    case 'End':
      return entries[entries.length - 1].id;
    case 'PageDown':
      return entries[Math.min(entries.length - 1, currentIndex + jump)].id;
    case 'PageUp':
      return entries[Math.max(0, currentIndex - jump)].id;
    case 'ArrowDown':
      return entries[Math.min(entries.length - 1, currentIndex + 1)].id;
    case 'ArrowUp':
      return entries[Math.max(0, currentIndex - 1)].id;
    default:
      return activeId;
  }
}
