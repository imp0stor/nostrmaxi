/**
 * Relay Sync Service
 * 
 * Background service that populates local relay with Nostr events.
 * Implements selective archival strategy for analytics and discovery.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';

export interface RelaySyncConfig {
  enabled: boolean;
  localRelayUrl: string;
  sourceRelays: string[];
  syncIntervalMs: number;
  strategy: 'wot' | 'popular' | 'recent' | 'all';
  wotPubkeys?: string[]; // Pubkeys to track (user + WoT)
  sinceDays?: number; // How far back to sync (default: 30 days)
}

@Injectable()
export class RelaySyncService implements OnModuleInit {
  private readonly logger = new Logger(RelaySyncService.name);
  private pool: SimplePool;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;
  private stats = {
    totalEvents: 0,
    lastSyncAt: 0,
    lastSyncDurationMs: 0,
    errors: 0,
  };

  constructor(private readonly configService: ConfigService) {
    this.pool = new SimplePool();
  }

  async onModuleInit() {
    const config = this.getConfig();
    if (!config.enabled) {
      this.logger.log('Relay sync disabled (RELAY_SYNC_ENABLED=false)');
      return;
    }

    this.logger.log(
      `Relay sync enabled: ${config.localRelayUrl} ← ${config.sourceRelays.length} sources (${config.strategy} strategy)`,
    );

    // Start initial sync
    await this.syncOnce();

    // Schedule periodic syncs
    this.syncTimer = setInterval(
      () => this.syncOnce(),
      config.syncIntervalMs,
    );
  }

  private getConfig(): RelaySyncConfig {
    return {
      enabled: this.configService.get('RELAY_SYNC_ENABLED') === 'true',
      localRelayUrl: this.configService.get('LOCAL_RELAY_URL') || 'ws://localhost:7777',
      sourceRelays: (this.configService.get('RELAY_SYNC_SOURCES') || 'wss://relay.damus.io,wss://relay.nostr.band,wss://nos.lol,wss://relay.primal.net')
        .split(',')
        .map((r: string) => r.trim())
        .filter(Boolean),
      syncIntervalMs: Number(this.configService.get('RELAY_SYNC_INTERVAL_MS') || 300000), // 5 min default
      strategy: (this.configService.get('RELAY_SYNC_STRATEGY') || 'recent') as any,
      wotPubkeys: (this.configService.get('RELAY_SYNC_WOT_PUBKEYS') || '')
        .split(',')
        .map((p: string) => p.trim())
        .filter(Boolean),
      sinceDays: Number(this.configService.get('RELAY_SYNC_SINCE_DAYS') || 30),
    };
  }

  async syncOnce(): Promise<void> {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping');
      return;
    }

    const config = this.getConfig();
    const startTime = Date.now();
    this.isSyncing = true;
    this.logger.log(`Starting sync (${config.strategy} strategy)...`);

    try {
      const filters = this.buildFilters(config);
      const newEvents: NostrEvent[] = [];

      // Fetch events from source relays
      for (const filter of filters) {
        try {
          const events = await this.pool.querySync(config.sourceRelays, filter as any);
          newEvents.push(...(events as NostrEvent[]));
          this.logger.debug(
            `Fetched ${events.length} events (kinds: ${filter.kinds?.join(',')})`,
          );
        } catch (error) {
          this.logger.error(`Failed to fetch events: ${error.message}`);
          this.stats.errors++;
        }
      }

      // Dedupe
      const seen = new Set<string>();
      const dedupedEvents = newEvents.filter((evt) => {
        if (seen.has(evt.id)) return false;
        seen.add(evt.id);
        return true;
      });

      this.logger.log(`Fetched ${dedupedEvents.length} unique events`);

      // Publish to local relay
      let published = 0;
      for (const event of dedupedEvents) {
        try {
          await this.pool.publish([config.localRelayUrl], event as any);
          published++;
        } catch (error) {
          this.logger.warn(`Failed to publish event ${event.id}: ${error.message}`);
          this.stats.errors++;
        }
      }

      const durationMs = Date.now() - startTime;
      this.stats.totalEvents += published;
      this.stats.lastSyncAt = Date.now();
      this.stats.lastSyncDurationMs = durationMs;

      this.logger.log(
        `Sync complete: ${published}/${dedupedEvents.length} published in ${durationMs}ms (total: ${this.stats.totalEvents}, errors: ${this.stats.errors})`,
      );
    } catch (error) {
      this.logger.error(`Sync failed: ${error.message}`, error.stack);
      this.stats.errors++;
    } finally {
      this.isSyncing = false;
    }
  }

  private buildFilters(config: RelaySyncConfig): any[] {
    const since = Math.floor(Date.now() / 1000) - ((config.sinceDays || 30) * 24 * 60 * 60);

    switch (config.strategy) {
      case 'wot':
        return this.buildWotFilters(config, since);
      case 'popular':
        return this.buildPopularFilters(since);
      case 'recent':
        return this.buildRecentFilters(since);
      case 'all':
        return this.buildAllFilters(since);
      default:
        return this.buildRecentFilters(since);
    }
  }

  private buildWotFilters(config: RelaySyncConfig, since: number): any[] {
    const authors = config.wotPubkeys || [];
    if (authors.length === 0) {
      this.logger.warn('WoT strategy selected but no pubkeys configured, falling back to recent');
      return this.buildRecentFilters(since);
    }

    return [
      // All content from WoT authors
      { kinds: [1], authors: authors.slice(0, 200), since, limit: 1000 },
      // Reactions/zaps to WoT content
      { kinds: [7, 9735], '#p': authors.slice(0, 200), since, limit: 1500 },
      // Metadata for WoT
      { kinds: [0, 3], authors: authors.slice(0, 200), limit: 300 },
    ];
  }

  private buildPopularFilters(since: number): any[] {
    // Strategy: Fetch events likely to be popular
    // This is a heuristic - we can't directly query "popular" events without analytics
    return [
      // Recent notes from high-reach relays (Damus, Primal tend to have popular content)
      { kinds: [1], since, limit: 1000 },
      // Zaps (people only zap good content)
      { kinds: [9735], since, limit: 1500 },
      // Reposts (indicator of popularity)
      { kinds: [6], since, limit: 500 },
    ];
  }

  private buildRecentFilters(since: number): any[] {
    return [
      // Recent notes
      { kinds: [1], since, limit: 1000 },
      // Recent reactions
      { kinds: [7], since, limit: 1500 },
      // Recent zaps
      { kinds: [9735], since, limit: 1500 },
      // Recent metadata
      { kinds: [0, 3], since, limit: 300 },
      // Recent reposts
      { kinds: [6], since, limit: 300 },
    ];
  }

  private buildAllFilters(since: number): any[] {
    // WARNING: This will fetch A LOT of events
    return [
      { kinds: [0, 1, 3, 6, 7, 9735], since, limit: 5000 },
    ];
  }

  getStats() {
    return { ...this.stats };
  }

  async onModuleDestroy() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.pool.close(this.getConfig().sourceRelays);
  }
}
