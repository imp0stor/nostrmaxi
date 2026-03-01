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
