import { applyCatalogFilters, groupByCategory, type CatalogFilterableEntry } from '../src/pages/ecosystemCatalogFilters';

const entries: CatalogFilterableEntry[] = [
  {
    id: 'a',
    name: 'Relay Prime',
    category: 'infrastructure',
    subcategory: 'relay',
    description: 'Reliable relay stack',
    pricing: 'free',
    trustScore: 81,
    rankingScore: 90,
    tags: ['relay', 'ops'],
  },
  {
    id: 'b',
    name: 'Client Gold',
    category: 'clients-apps',
    subcategory: 'desktop',
    description: 'Polished client UX',
    pricing: 'paid',
    trustScore: 74,
    rankingScore: 80,
    tags: ['client', 'ux'],
  },
  {
    id: 'c',
    name: 'Indexer Core',
    category: 'infrastructure',
    subcategory: 'indexing',
    description: 'Search and indexing',
    pricing: 'free',
    trustScore: 62,
    rankingScore: 76,
    tags: ['search', 'relay'],
  },
];

describe('EcosystemCatalogPage filter helpers', () => {
  it('returns all entries by default (list visible without guessed search)', () => {
    const result = applyCatalogFilters(entries, {
      search: '',
      category: '',
      pricing: '',
      tag: '',
      minTrust: 0,
    });

    expect(result.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('combines key filters to narrow results', () => {
    const result = applyCatalogFilters(entries, {
      search: 'relay',
      category: 'infrastructure',
      pricing: 'free',
      tag: 'relay',
      minTrust: 70,
    });

    expect(result.map((entry) => entry.id)).toEqual(['a']);
  });

  it('groups by category and sorts by ranking in each section', () => {
    const result = groupByCategory(entries);

    expect(result.map((group) => group.category)).toEqual(['clients-apps', 'infrastructure']);
    expect(result.find((group) => group.category === 'infrastructure')?.entries.map((entry) => entry.id)).toEqual(['a', 'c']);
  });
});
