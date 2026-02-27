import { useEffect, useMemo, useState } from 'react';
import { compareCatalog, fetchCatalog, loadCollections, recommendCatalog, saveCollection, type CatalogEntry } from '../lib/ecosystemCatalog';

export function EcosystemCatalogPage() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [collections, setCollections] = useState<Record<string, string[]>>({});

  useEffect(() => {
    void (async () => {
      const data = await fetchCatalog();
      setEntries(data.entries || []);
      const c = await loadCollections();
      setCollections(c.collections || {});
    })();
  }, []);

  const filtered = useMemo(() => entries.filter((entry) => {
    if (category && entry.category !== category) return false;
    if (search && !`${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [entries, category, search]);

  const toggle = (id: string) => setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-3));

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="cy-card p-4">
        <h1 className="text-2xl text-cyan-100 font-semibold">Nostr Ecosystem Catalog</h1>
        <p className="text-gray-300 mt-1">Discovery, ranking, analytics, comparison, and collections for Nostr infrastructure + apps.</p>
        <div className="mt-4 grid md:grid-cols-3 gap-3">
          <input className="bg-slate-950 border border-cyan-500/30 rounded px-3 py-2" placeholder="Search projects, tags, features" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="bg-slate-950 border border-cyan-500/30 rounded px-3 py-2" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="clients-apps">Clients/Apps</option>
            <option value="services">Services</option>
            <option value="portals-platforms">Portals/Platforms</option>
            <option value="developer-tools">Developer Tools</option>
          </select>
          <button className="cy-btn" onClick={async () => setRecommendations(await recommendCatalog({ category: category || undefined }))}>Get recommendations</button>
        </div>
      </div>

      <div className="cy-card p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-cyan-100 font-semibold">Catalog entries ({filtered.length})</h2>
          <button className="cy-btn-secondary" onClick={async () => setComparison(await compareCatalog(selected))}>Compare selected</button>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {filtered.map((entry) => (
            <label key={entry.id} className="border border-slate-700 rounded p-3 flex gap-2">
              <input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} />
              <div>
                <p className="text-cyan-100 font-medium">{entry.name} <span className="text-xs text-gray-400">({entry.subcategory})</span></p>
                <p className="text-sm text-gray-300">{entry.description}</p>
                <p className="text-xs text-gray-400 mt-1">Trust {entry.trustScore} · Rank {entry.rankingScore} · {entry.pricing}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {!!comparison.length && (
        <div className="cy-card p-4">
          <h2 className="text-cyan-100 font-semibold">Comparison</h2>
          <pre className="text-xs text-gray-200 mt-2 overflow-auto">{JSON.stringify(comparison, null, 2)}</pre>
        </div>
      )}

      {!!recommendations.length && (
        <div className="cy-card p-4">
          <h2 className="text-cyan-100 font-semibold">Recommendations</h2>
          <ul className="mt-2 space-y-2">
            {recommendations.map((r) => <li key={r.id} className="text-sm text-gray-200">{r.name} — {r.reason}</li>)}
          </ul>
        </div>
      )}

      <div className="cy-card p-4">
        <h2 className="text-cyan-100 font-semibold">Collections</h2>
        <div className="flex gap-2 mt-2">
          <button className="cy-btn-secondary" onClick={async () => { const name = prompt('Collection name'); if (!name) return; const next = await saveCollection(name, selected); setCollections(next.collections || {}); }}>Save selected as collection</button>
        </div>
        <pre className="text-xs text-gray-300 mt-3 overflow-auto">{JSON.stringify(collections, null, 2)}</pre>
      </div>
    </div>
  );
}
