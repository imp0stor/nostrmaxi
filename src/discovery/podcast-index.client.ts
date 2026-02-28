import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

const PODCAST_INDEX_API = 'https://api.podcastindex.org/api/1.0';

export interface PodcastIndexPodcast {
  id: number;
  title: string;
  description?: string;
  author?: string;
  url?: string;
  image?: string;
  value?: unknown;
  [key: string]: unknown;
}

@Injectable()
export class PodcastIndexClient {
  private readonly logger = new Logger(PodcastIndexClient.name);

  constructor(private readonly configService: ConfigService) {}

  async searchPodcasts(query: string): Promise<PodcastIndexPodcast[]> {
    if (!query.trim()) return [];

    const key = this.configService.get<string>('PODCAST_INDEX_KEY');
    const secret = this.configService.get<string>('PODCAST_INDEX_SECRET');

    if (!key || !secret) {
      this.logger.warn('Podcast Index credentials are not set; returning empty result set');
      return [];
    }

    const authDate = Math.floor(Date.now() / 1000).toString();
    const authHeader = createHash('sha1').update(`${key}${secret}${authDate}`).digest('hex');
    const url = `${PODCAST_INDEX_API}/search/byterm?q=${encodeURIComponent(query)}&max=20`;

    const response = await fetch(url, {
      headers: {
        'X-Auth-Key': key,
        'X-Auth-Date': authDate,
        Authorization: authHeader,
        'User-Agent': 'NostrMaxi/1.0',
      },
    });

    if (!response.ok) {
      this.logger.warn(`Podcast Index search failed with ${response.status}`);
      return [];
    }

    const body = await response.json() as { feeds?: PodcastIndexPodcast[] };
    return Array.isArray(body.feeds) ? body.feeds : [];
  }
}
