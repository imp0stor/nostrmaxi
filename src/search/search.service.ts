import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { BeaconClient } from './beacon.client';
import { SearchMetricsService } from './search-metrics.service';

export interface SearchMeta {
  source: 'beacon' | 'cache' | 'fallback';
  cache: 'hit' | 'miss';
  beaconAvailable: boolean;
  latencyMs?: number;
  retrievedAt: string;
  error?: string;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly cacheTtlMs: number;

  constructor(
    private beaconClient: BeaconClient,
    private metrics: SearchMetricsService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.cacheTtlMs = parseInt(
      this.configService.get<string>('BEACON_SEARCH_CACHE_TTL_MS') || '120000',
      10,
    );
  }

  async search(query: Record<string, unknown>) {
    const normalizedQuery = this.normalizeQuery(query);
    return this.executeSearch('search', normalizedQuery, () =>
      this.beaconClient.search(normalizedQuery),
    );
  }

  async searchFiltered(body: Record<string, unknown>) {
    const normalizedBody = this.normalizeQuery(body);
    return this.executeSearch('search/filtered', normalizedBody, () =>
      this.beaconClient.searchFiltered(normalizedBody),
    );
  }

  private async executeSearch(
    endpoint: string,
    payload: Record<string, unknown>,
    executor: () => Promise<unknown>,
  ) {
    this.metrics.recordRequest();
    const queryLabel = typeof payload.q === 'string' ? payload.q.slice(0, 120) : undefined;
    this.logger.log(`Beacon ${endpoint} request${queryLabel ? ` q="${queryLabel}"` : ''}`);
    const cacheKey = this.buildCacheKey(endpoint, payload);

    const cached = await this.cacheManager.get<unknown>(cacheKey);
    if (cached) {
      this.metrics.recordCacheHit();
      return this.attachMeta(cached, {
        source: 'cache',
        cache: 'hit',
        beaconAvailable: true,
        retrievedAt: new Date().toISOString(),
      });
    }

    const startedAt = Date.now();

    try {
      const response = await executor();
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordSuccess(latencyMs);

      const resultWithMeta = this.attachMeta(response, {
        source: 'beacon',
        cache: 'miss',
        beaconAvailable: true,
        latencyMs,
        retrievedAt: new Date().toISOString(),
      });

      await this.cacheManager.set(cacheKey, resultWithMeta, this.cacheTtlMs);

      return resultWithMeta;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      this.metrics.recordFailure(error);
      this.logger.warn(`Beacon ${endpoint} failed after ${latencyMs}ms: ${this.describeError(error)}`);

      return {
        results: [],
        nostrmaxi: {
          source: 'fallback',
          cache: 'miss',
          beaconAvailable: false,
          latencyMs,
          retrievedAt: new Date().toISOString(),
          error: this.describeError(error),
        },
      };
    }
  }

  private normalizeQuery(input: Record<string, unknown>) {
    const output: Record<string, unknown> = {};
    Object.entries(input || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (key === 'limit' || key === 'offset') {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          output[key] = parsed;
        }
        return;
      }

      if (key === 'facets') {
        if (typeof value === 'boolean') {
          output[key] = value;
        } else {
          output[key] = value === 'true' || value === '1';
        }
        return;
      }

      output[key] = value;
    });

    return output;
  }

  private buildCacheKey(endpoint: string, payload: Record<string, unknown>) {
    const sortedPayload = this.sortObject(payload);
    const raw = JSON.stringify({ endpoint, payload: sortedPayload });
    const hash = createHash('sha256').update(raw).digest('hex');
    return `beacon-search:${hash}`;
  }

  private sortObject(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sortObject(entry));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.sortObject((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }

    return value;
  }

  private attachMeta(response: unknown, meta: SearchMeta) {
    if (response && typeof response === 'object') {
      return {
        ...(response as Record<string, unknown>),
        nostrmaxi: meta,
      };
    }

    return {
      response,
      nostrmaxi: meta,
    };
  }

  private describeError(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}
