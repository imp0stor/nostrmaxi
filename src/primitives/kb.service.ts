import { Injectable } from '@nestjs/common';
import { parseKBArticle, extractSummary, buildKBFilter, type ParsedKBArticle } from '@strangesignal/nostr-kb';
import { SimplePool } from 'nostr-tools';

@Injectable()
export class PrimitiveKbService {
  private readonly relays = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

  private parseArticles(events: any[]): ParsedKBArticle[] {
    const parsed: ParsedKBArticle[] = [];
    for (const event of events) {
      try {
        parsed.push(parseKBArticle(event));
      } catch {
        // skip invalid/unsigned data
      }
    }
    return parsed;
  }

  async list(limit = 20) {
    const pool = new SimplePool();
    try {
      const filter = buildKBFilter({ limit: Math.min(Math.max(limit, 1), 50) }) as any;
      const events = await pool.querySync(this.relays, filter);
      const articles = this.parseArticles(events)
        .sort((a, b) => (b.updatedAt || b.publishedAt || b.createdAt) - (a.updatedAt || a.publishedAt || a.createdAt))
        .slice(0, limit)
        .map((article) => ({
          id: article.eventId,
          identifier: article.identifier,
          title: article.title,
          summary: extractSummary(article, 200),
          tags: article.tags || [],
          docType: article.docType || 'article',
          difficulty: article.difficulty || 'intermediate',
          updatedAt: article.updatedAt || article.publishedAt || article.createdAt,
          authorPubkey: article.authorPubkey,
        }));

      return { total: articles.length, items: articles };
    } finally {
      pool.close(this.relays);
    }
  }

  async search(query: string, limit = 20) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return { total: 0, items: [] };

    const listed = await this.list(50);
    const items = listed.items.filter((item) =>
      item.title.toLowerCase().includes(normalized)
      || item.summary.toLowerCase().includes(normalized)
      || item.tags.some((tag) => tag.toLowerCase().includes(normalized)),
    ).slice(0, Math.min(Math.max(limit, 1), 50));

    return { total: items.length, items };
  }
}
