import { useEffect, useMemo, useState } from 'react';
import {
  compareCatalog,
  fetchCatalog,
  loadCollections,
  recommendCatalog,
  saveCollection,
  type CatalogEntry,
} from '../lib/ecosystemCatalog';
import {
  applyCatalogFilters,
  DEFAULT_CATALOG_FILTERS,
  groupByCategory,
  type CatalogFilters,
} from './ecosystemCatalogFilters';

function categoryLabel(category: string) {
  return category
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function EcosystemCatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [collections, setCollections] = useState<Record<string, string[]>>({});
  const [activeEntryId, setActiveEntryId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [catalogData, collectionData] = await Promise.all([fetchCatalog(), loadCollections()]);
        const nextEntries = catalogData.entries || [];
        setEntries(nextEntries);
        setCollections(collectionData.collections || {});
        if (nextEntries.length > 0) {
          setActiveEntryId(nextEntries[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ecosystem catalog');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => [...new Set(entries.map((entry) => entry.category))].sort(), [entries]);
  const pricingOptions = useMemo(() => [...new Set(entries.map((entry) => entry.pricing))].sort(), [entries]);
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [entries]);

  const filtered = useMemo(() => applyCatalogFilters(entries, filters), [entries, filters]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  const activeEntry = useMemo(() => {
    if (!activeEntryId) return null;
    return filtered.find((entry) => entry.id === activeEntryId) || null;
  }, [activeEntryId, filtered]);

  useEffect(() => {
    if (!filtered.length) {
      setActiveEntryId('');
      return;
    }

    if (!activeEntryId || !filtered.some((entry) => entry.id === activeEntryId)) {
      setActiveEntryId(filtered[0].id);
    }
  }, [filtered, activeEntryId]);

  const toggleCompareSelection = (id: string) => {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-3)));
  };

  const resetFilters = () => setFilters(DEFAULT_CATALOG_FILTERS);

  const filterPillClass = (active: boolean) =>
    `cy-chip ${active ? 'border-orange-300/80 text-orange-100 shadow-[0_0_14px_rgba(249,115,22,0.22)]' : 'text-gray-200'}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <section className="cy-card p-4 space-y-4">
        <div>
          <h1 className="text-2xl text-orange-100 font-semibold">Nostr Ecosystem Catalog</h1>
          <p className="text-gray-300 mt-1">Browse by category, narrow with visible filters, and open details without losing the list context.</p>
        </div>

        <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.15em] text-orange-200/80">Search</span>
            <input
              className="cy-input"
              placeholder="Search names, tags, subcategories"
              value={filters.search}
              onChange={(e) => setFilters((cur) => ({ ...cur, search: e.target.value }))}
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.15em] text-orange-200/80">Pricing</span>
            <select
              className="cy-input"
              value={filters.pricing}
              onChange={(e) => setFilters((cur) => ({ ...cur, pricing: e.target.value }))}
            >
              <option value="">Any pricing</option>
              {pricingOptions.map((pricing) => (
                <option key={pricing} value={pricing}>{pricing}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.15em] text-orange-200/80">Tag focus</span>
            <select
              className="cy-input"
              value={filters.tag}
              onChange={(e) => setFilters((cur) => ({ ...cur, tag: e.target.value }))}
            >
              <option value="">Any tag</option>
              {topTags.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs uppercase tracking-[0.15em] text-orange-200/80">Minimum trust ({filters.minTrust})</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.minTrust}
              onChange={(e) => setFilters((cur) => ({ ...cur, minTrust: Number(e.target.value) }))}
              className="w-full accent-orange-400 h-10"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className={filterPillClass(filters.category === '')}
            onClick={() => setFilters((cur) => ({ ...cur, category: '' }))}
            aria-pressed={filters.category === ''}
          >
            All categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={filterPillClass(filters.category === category)}
              onClick={() => setFilters((cur) => ({ ...cur, category }))}
              aria-pressed={filters.category === category}
            >
              {categoryLabel(category)}
            </button>
          ))}
          <button type="button" className="cy-btn-secondary" onClick={resetFilters}>Reset filters</button>
          <button
            type="button"
            className="cy-btn"
            onClick={async () => setRecommendations(await recommendCatalog({ category: filters.category || undefined }))}
          >
            Get recommendations
          </button>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.35fr_0.95fr] gap-4">
        <div className="cy-card p-4">
          <div className="flex flex-wrap justify-between gap-2 items-center mb-3">
            <h2 className="text-orange-100 font-semibold">Catalog list ({filtered.length})</h2>
            <button
              className="cy-btn-secondary"
              disabled={selected.length < 2}
              onClick={async () => setComparison(await compareCatalog(selected))}
            >
              Compare selected ({selected.length}/3)
            </button>
          </div>

          {isLoading ? (
            <div className="cy-panel p-4 text-sm text-gray-300">Loading ecosystem entries…</div>
          ) : error ? (
            <div className="cy-panel p-4 text-sm text-red-300">{error}</div>
          ) : grouped.length === 0 ? (
            <div className="cy-panel p-4 space-y-2 text-sm text-gray-300">
              <p>No entries match the current filters.</p>
              <button type="button" className="cy-btn-secondary" onClick={resetFilters}>Clear filters</button>
            </div>
          ) : (
            <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1" aria-label="Ecosystem categories">
              {grouped.map((section) => (
                <section key={section.category} className="space-y-2">
                  <h3 className="text-sm uppercase tracking-[0.16em] text-orange-200/85">{categoryLabel(section.category)} ({section.entries.length})</h3>
                  <div className="space-y-2">
                    {section.entries.map((entry) => {
                      const isActive = activeEntryId === entry.id;
                      const isCompared = selected.includes(entry.id);

                      return (
                        <article
                          key={entry.id}
                          className={`rounded-xl border p-3 bg-[rgba(20,14,16,0.92)] ${isActive ? 'border-orange-300/70 shadow-[0_0_16px_rgba(249,115,22,0.18)]' : 'border-orange-200/20'}`}
                        >
                          <div className="flex gap-3 items-start">
                            <button
                              type="button"
                              className="text-left flex-1 min-w-0"
                              onClick={() => setActiveEntryId(entry.id)}
                              aria-expanded={isActive}
                              aria-controls={`ecosystem-detail-${entry.id}`}
                            >
                              <p className="text-orange-100 font-medium truncate">{entry.name} <span className="text-xs text-gray-400">({entry.subcategory})</span></p>
                              <p className="text-sm text-gray-300 line-clamp-2">{entry.description}</p>
                              <p className="text-xs text-gray-400 mt-1">Trust {entry.trustScore} · Rank {entry.rankingScore} · {entry.pricing}</p>
                            </button>
                            <label className="text-xs text-gray-200 flex items-center gap-2 select-none">
                              <input
                                type="checkbox"
                                checked={isCompared}
                                onChange={() => toggleCompareSelection(entry.id)}
                              />
                              Compare
                            </label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="cy-card p-4 space-y-3 lg:sticky lg:top-20 h-fit">
          <h2 className="text-orange-100 font-semibold">Drilldown</h2>
          {!activeEntry ? (
            <div className="cy-panel p-3 text-sm text-gray-300">Pick any catalog entry to inspect details.</div>
          ) : (
            <div id={`ecosystem-detail-${activeEntry.id}`} className="space-y-3" role="region" aria-label={`${activeEntry.name} details`}>
              <div>
                <p className="text-lg text-orange-100 font-semibold">{activeEntry.name}</p>
                <p className="text-sm text-gray-300 mt-1">{activeEntry.description}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div className="cy-panel p-2"><dt className="text-gray-400">Category</dt><dd className="text-orange-100">{categoryLabel(activeEntry.category)}</dd></div>
                <div className="cy-panel p-2"><dt className="text-gray-400">Subcategory</dt><dd className="text-orange-100">{activeEntry.subcategory}</dd></div>
                <div className="cy-panel p-2"><dt className="text-gray-400">Trust</dt><dd className="text-orange-100">{activeEntry.trustScore}</dd></div>
                <div className="cy-panel p-2"><dt className="text-gray-400">Ranking</dt><dd className="text-orange-100">{activeEntry.rankingScore}</dd></div>
              </dl>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-orange-200/80 mb-1">Supported NIPs</p>
                <div className="flex flex-wrap gap-2">
                  {activeEntry.supportedNips.length ? activeEntry.supportedNips.map((nip) => (
                    <span key={nip} className="cy-chip cy-chip-static text-xs">{nip}</span>
                  )) : <span className="text-xs text-gray-400">No NIPs listed.</span>}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-orange-200/80 mb-1">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {activeEntry.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={filterPillClass(filters.tag === tag)}
                      onClick={() => setFilters((cur) => ({ ...cur, tag: cur.tag === tag ? '' : tag }))}
                      aria-pressed={filters.tag === tag}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
              <a
                href={activeEntry.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex cy-btn-secondary"
              >
                Open project website
              </a>
            </div>
          )}
        </aside>
      </section>

      {!!comparison.length && (
        <section className="cy-card p-4">
          <h2 className="text-orange-100 font-semibold">Comparison</h2>
          <pre className="text-xs text-gray-200 mt-2 overflow-auto max-h-72">{JSON.stringify(comparison, null, 2)}</pre>
        </section>
      )}

      {!!recommendations.length && (
        <section className="cy-card p-4">
          <h2 className="text-orange-100 font-semibold">Recommendations</h2>
          <ul className="mt-2 space-y-2">
            {recommendations.map((recommendation) => (
              <li key={recommendation.id} className="text-sm text-gray-200">
                <span className="text-orange-100 font-medium">{recommendation.name}</span> — {recommendation.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="cy-card p-4">
        <h2 className="text-orange-100 font-semibold">Collections</h2>
        <div className="flex gap-2 mt-2">
          <button
            className="cy-btn-secondary"
            onClick={async () => {
              const name = prompt('Collection name');
              if (!name) return;
              const next = await saveCollection(name, selected);
              setCollections(next.collections || {});
            }}
          >
            Save selected as collection
          </button>
        </div>
        <pre className="text-xs text-gray-300 mt-3 overflow-auto max-h-60">{JSON.stringify(collections, null, 2)}</pre>
      </section>
    </div>
  );
}
