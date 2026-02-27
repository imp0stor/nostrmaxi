import { Injectable } from '@nestjs/common';

export interface UnfurlResult {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  image?: string;
  audio?: string;
  siteName?: string;
}

interface CacheEntry {
  expiresAt: number;
  data: UnfurlResult;
}

@Injectable()
export class UnfurlService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 1000 * 60 * 30;

  async unfurl(rawUrl: string): Promise<UnfurlResult> {
    const normalized = this.normalize(rawUrl);
    const cached = this.cache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const html = await this.fetchHtml(normalized);
    const result = this.extractMetadata(normalized, html);

    this.cache.set(normalized, {
      expiresAt: Date.now() + this.ttlMs,
      data: result,
    });

    return result;
  }

  private normalize(rawUrl: string): string {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only http/https URLs are allowed');
    }

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      throw new Error('Local/internal URLs are not allowed');
    }

    return url.toString();
  }

  private async fetchHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'NostrMaxiBot/1.0 (+https://nostrmaxi.com)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL (${response.status})`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractTag(html: string, key: string, attr: 'property' | 'name' = 'property'): string | undefined {
    const regex = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const match = html.match(regex);
    return match?.[1]?.trim();
  }

  private extractTitle(html: string): string | undefined {
    const ogTitle = this.extractTag(html, 'og:title');
    if (ogTitle) return ogTitle;
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch?.[1]?.trim();
  }

  private toAbsolute(baseUrl: string, maybeUrl?: string): string | undefined {
    if (!maybeUrl) return undefined;
    try {
      return new URL(maybeUrl, baseUrl).toString();
    } catch {
      return undefined;
    }
  }

  private extractMetadata(url: string, html: string): UnfurlResult {
    const domain = new URL(url).hostname.replace(/^www\./, '');

    const title = this.extractTitle(html);
    const description = this.extractTag(html, 'og:description') || this.extractTag(html, 'description', 'name');
    const image = this.toAbsolute(url, this.extractTag(html, 'og:image'));
    const audio = this.toAbsolute(url, this.extractTag(html, 'og:audio') || this.extractTag(html, 'twitter:player:stream', 'name'));
    const siteName = this.extractTag(html, 'og:site_name');

    return {
      url,
      domain,
      title,
      description,
      image,
      audio,
      siteName,
    };
  }
}
