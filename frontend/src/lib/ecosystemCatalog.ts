const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface CatalogEntry {
  id: string;
  name: string;
  url: string;
  category: string;
  subcategory: string;
  description: string;
  pricing: string;
  trustScore: number;
  rankingScore: number;
  supportedNips: string[];
  tags: string[];
}

export async function fetchCatalog(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/ecosystem/catalog${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch ecosystem catalog');
  return res.json();
}

export async function compareCatalog(ids: string[]) {
  const res = await fetch(`${API_BASE}/ecosystem/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to compare entries');
  return res.json();
}

export async function recommendCatalog(input: { category?: string; requiredNips?: string[]; pricing?: string; tags?: string[] }) {
  const res = await fetch(`${API_BASE}/ecosystem/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to get recommendations');
  return res.json();
}

export async function loadCollections() {
  const res = await fetch(`${API_BASE}/ecosystem/collections`);
  if (!res.ok) throw new Error('Failed to load collections');
  return res.json();
}

export async function saveCollection(name: string, ids: string[]) {
  const res = await fetch(`${API_BASE}/ecosystem/collections/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to save collection');
  return res.json();
}
