import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { DEFAULT_ECOSYSTEM_DB } from './ecosystem-catalog.seed';
import { CatalogDatabase, CatalogEntry, CatalogQuery } from './ecosystem-catalog.types';

@Injectable()
export class EcosystemCatalogService {
  private readonly logger = new Logger(EcosystemCatalogService.name);
  private readonly dbPath = join(process.cwd(), 'data', 'ecosystem-catalog.json');

  private async loadDb(): Promise<CatalogDatabase> {
    try {
      const raw = await readFile(this.dbPath, 'utf8');
      return JSON.parse(raw) as CatalogDatabase;
    } catch {
      await this.saveDb(DEFAULT_ECOSYSTEM_DB);
      return DEFAULT_ECOSYSTEM_DB;
    }
  }

  private async saveDb(db: CatalogDatabase) {
    await mkdir(join(process.cwd(), 'data'), { recursive: true });
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), 'utf8');
  }

  private rank(entry: CatalogEntry): number {
    const featureDepth = Math.min(100, entry.supportedNips.length * 10 + entry.features.length * 4);
    const reviewAvg = entry.reviews.length
      ? (entry.reviews.reduce((sum, r) => sum + r.rating, 0) / entry.reviews.length) * 20
      : 60;
    const reliability = entry.metrics.uptime * 100;
    return Math.round((entry.trustScore * 0.35) + (reliability * 0.25) + (featureDepth * 0.2) + (entry.metrics.activityScore * 0.1) + (reviewAvg * 0.1));
  }

  private matches(entry: CatalogEntry, q: CatalogQuery): boolean {
    if (q.category && entry.category !== q.category) return false;
    if (q.subcategory && entry.subcategory !== q.subcategory) return false;
    if (q.pricing && entry.pricing !== q.pricing) return false;
    if (q.status && entry.status !== q.status) return false;
    if (q.nip && !entry.supportedNips.includes(q.nip)) return false;
    if (typeof q.minTrust === 'number' && entry.trustScore < q.minTrust) return false;
    if (q.tags?.length && !q.tags.every((t) => entry.tags.includes(t))) return false;
    if (q.q) {
      const hay = `${entry.name} ${entry.description} ${entry.tags.join(' ')} ${entry.features.join(' ')}`.toLowerCase();
      if (!hay.includes(q.q.toLowerCase())) return false;
    }
    return true;
  }

  async list(query: CatalogQuery) {
    const db = await this.loadDb();
    const entries = db.entries
      .filter((entry) => this.matches(entry, query))
      .map((entry) => ({ ...entry, rankingScore: this.rank(entry) }))
      .sort((a, b) => b.rankingScore - a.rankingScore);

    return {
      generatedAt: db.generatedAt,
      sources: db.sources,
      total: entries.length,
      entries,
    };
  }

  async getById(id: string) {
    const db = await this.loadDb();
    const entry = db.entries.find((item) => item.id === id);
    if (!entry) return null;
    return {
      ...entry,
      rankingScore: this.rank(entry),
      analytics: {
        trendDelta: entry.metrics.trend30d.at(-1)! - entry.metrics.trend30d[0],
        health: entry.metrics.uptime > 0.99 ? 'excellent' : entry.metrics.uptime > 0.97 ? 'good' : 'watch',
      },
    };
  }

  async compare(ids: string[]) {
    const db = await this.loadDb();
    const selected = db.entries.filter((entry) => ids.includes(entry.id));
    return selected.map((entry) => ({
      id: entry.id,
      name: entry.name,
      pricing: entry.pricing,
      trustScore: entry.trustScore,
      rankingScore: this.rank(entry),
      uptime: entry.metrics.uptime,
      monthlyUsers: entry.metrics.monthlyUsers,
      supportedNips: entry.supportedNips,
      features: entry.features,
    }));
  }

  async recommend(input: { category?: string; requiredNips?: string[]; pricing?: string; tags?: string[] }) {
    const db = await this.loadDb();
    return db.entries
      .filter((entry) => {
        if (input.category && entry.category !== input.category) return false;
        if (input.pricing && entry.pricing !== input.pricing) return false;
        if (input.requiredNips?.length && !input.requiredNips.every((nip) => entry.supportedNips.includes(nip))) return false;
        if (input.tags?.length && !input.tags.some((tag) => entry.tags.includes(tag))) return false;
        return true;
      })
      .map((entry) => ({
        ...entry,
        rankingScore: this.rank(entry),
        reason: `Trust ${entry.trustScore}, uptime ${(entry.metrics.uptime * 100).toFixed(2)}%, feature depth ${entry.features.length}`,
      }))
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, 10);
  }

  async discover() {
    const db = await this.loadDb();
    // Baseline discovery hook: tracks update timestamps and source audit.
    db.generatedAt = new Date().toISOString();
    db.sources = [...new Set([...db.sources, 'discover:manual-refresh'])];
    db.entries = db.entries.map((entry) => ({ ...entry, lastUpdated: db.generatedAt }));
    await this.saveDb(db);
    this.logger.log(`Discovery refresh complete (${db.entries.length} entries)`);
    return { ok: true, entries: db.entries.length, generatedAt: db.generatedAt };
  }

  async getCollections() {
    const db = await this.loadDb();
    const path = join(process.cwd(), 'data', 'ecosystem-collections.json');
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch {
      const initial = { generatedAt: db.generatedAt, collections: {} as Record<string, string[]> };
      await writeFile(path, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
  }

  async saveCollection(name: string, ids: string[]) {
    const collections = await this.getCollections();
    collections.collections[name] = [...new Set(ids)];
    collections.generatedAt = new Date().toISOString();
    const path = join(process.cwd(), 'data', 'ecosystem-collections.json');
    await writeFile(path, JSON.stringify(collections, null, 2), 'utf8');
    return collections;
  }
}
