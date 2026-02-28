import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SimplePool, type Event as NostrEvent } from 'nostr-tools';
import { NoiseFilterService } from '../sync/noise-filter.service';

// Enable WebSocket for Node.js
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const { useWebSocketImplementation } = require('nostr-tools/pool');
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
useWebSocketImplementation(require('ws'));
import { RetentionPolicy, SyncPriorityService, SyncTier } from '../sync/sync-priority.service';
import { RetentionCleanupService } from '../sync/retention-cleanup.service';
import { IngestionService } from './ingestion.service';
import { TrendingService } from './trending.service';

const SOURCE_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://purplepag.es',
];

const LOCAL_RELAY = 'ws://10.1.10.143:7777';

// Notable accounts to seed
const NOTABLE_PUBKEYS = [
  '82341f882b6eabcd2ba7f1ef90aad961cf074af15b9ef44a09f9d2a8fbfbe6a2', // jack
  '04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9', // odell
  'e88a691e98d9987c964521dff60025f60700378a4879180dcbbb4a5027850411', // nvk
  '472f440f29ef996e92a186b8d320ff180c855903882e59d50de1b8bd5669301e', // marty bent
  'fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52', // pablof7z
  '6e468422dfb74a5738702a8823b9b28168abab8655faacb6853cd0ee15deee93', // gigi
  '32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245', // jb55
];

@Injectable()
export class AggregatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AggregatorService.name);
  private prioritySyncTimer: NodeJS.Timeout | null = null;
  private pool: SimplePool;
  private isRunning = false;

  constructor(
    private readonly syncPriority: SyncPriorityService,
    private readonly noiseFilter: NoiseFilterService,
    private readonly ingestion: IngestionService,
    private readonly trending: TrendingService,
    private readonly retentionCleanup: RetentionCleanupService,
  ) {
    this.pool = new SimplePool();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Aggregator service starting...');
    
    // Run initial sync after 10 seconds (let app start up)
    setTimeout(() => {
      this.runInitialSync().catch(err => {
        this.logger.error(`Initial sync failed: ${err.message}`);
      });
    }, 10000);

    // Every 6 hours run priority sync
    this.prioritySyncTimer = setInterval(() => {
      this.syncPriorityPubkeys().catch((error) => {
        this.logger.error(`Priority sync failed: ${(error as Error).message}`);
      });
    }, 6 * 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.prioritySyncTimer) {
      clearInterval(this.prioritySyncTimer);
      this.prioritySyncTimer = null;
    }
  }

  async processEvent(event: NostrEvent): Promise<void> {
    const noiseCheck = await this.noiseFilter.isNoise(event);
    if (noiseCheck.isNoise && noiseCheck.confidence > 0.7) {
      this.logger.debug(`Filtered noise: ${event.id} (${noiseCheck.reason})`);
      return;
    }

    const priority = await this.syncPriority.getPriority(event.pubkey);

    if (priority.tier <= SyncTier.TANGENTIAL) {
      await this.ingestion.syncEvent(event, priority.retention);
      return;
    }

    if (priority.tier === SyncTier.TRENDING) {
      const score = this.trending.getScore(event.id);
      if (score >= 10) {
        await this.ingestion.syncEvent(event, priority.retention);
      }
      return;
    }

    if (await this.hasCapacity()) {
      await this.ingestion.syncEvent(event, RetentionPolicy.TEMPORARY);
    }
  }

  async syncPriorityPubkeys(): Promise<void> {
    const priorities = await this.syncPriority.getPriorityPubkeys();
    priorities.sort((a, b) => a.tier - b.tier);

    for (const p of priorities) {
      await this.syncUserComplete(p.pubkey, p.retention);
    }
  }

  private async syncUserComplete(pubkey: string, retention: RetentionPolicy): Promise<void> {
    this.logger.debug(`Syncing user ${pubkey.slice(0, 8)}...`);
    
    try {
      const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60; // 30 days
      
      // Fetch profile
      const profiles = await this.pool.querySync(SOURCE_RELAYS, {
        kinds: [0],
        authors: [pubkey],
        limit: 1,
      });
      
      // Fetch recent notes
      const notes = await this.pool.querySync(SOURCE_RELAYS, {
        kinds: [1],
        authors: [pubkey],
        since,
        limit: 50,
      });
      
      // Fetch follow list
      const follows = await this.pool.querySync(SOURCE_RELAYS, {
        kinds: [3],
        authors: [pubkey],
        limit: 1,
      });
      
      // Sync all to local relay
      const allEvents = [...profiles, ...notes, ...follows];
      let synced = 0;
      
      for (const event of allEvents) {
        try {
          await this.pool.publish([LOCAL_RELAY], event);
          synced++;
        } catch {
          // Ignore individual publish failures
        }
      }
      
      this.logger.debug(`Synced ${synced} events for ${pubkey.slice(0, 8)}`);
    } catch (error) {
      this.logger.error(`Failed to sync ${pubkey.slice(0, 8)}: ${(error as Error).message}`);
    }
  }

  // Public methods for controller
  async syncSingleUser(pubkey: string): Promise<void> {
    await this.syncUserComplete(pubkey, RetentionPolicy.PRIORITY);
  }

  triggerManualSync(): void {
    this.runInitialSync().catch(err => {
      this.logger.error(`Manual sync failed: ${err.message}`);
    });
  }

  async syncUserWot(pubkey: string): Promise<void> {
    this.logger.log(`Syncing WoT for ${pubkey.slice(0, 8)}...`);
    
    try {
      // Get follow list
      const follows = await this.pool.querySync(SOURCE_RELAYS, {
        kinds: [3],
        authors: [pubkey],
        limit: 1,
      });
      
      if (follows.length === 0) {
        this.logger.warn(`No follow list found for ${pubkey.slice(0, 8)}`);
        return;
      }
      
      const followPubkeys = (follows[0].tags || [])
        .filter(t => t[0] === 'p' && t[1])
        .map(t => t[1]);
      
      this.logger.log(`Found ${followPubkeys.length} follows, syncing first 100...`);
      
      // Sync first 100 follows
      const toSync = followPubkeys.slice(0, 100);
      for (let i = 0; i < toSync.length; i++) {
        this.logger.debug(`[${i + 1}/${toSync.length}] Syncing ${toSync[i].slice(0, 8)}...`);
        await this.syncUserComplete(toSync[i], RetentionPolicy.PRIORITY);
        await this.sleep(300);
      }
      
      this.logger.log(`WoT sync complete for ${pubkey.slice(0, 8)}`);
    } catch (error) {
      this.logger.error(`WoT sync failed: ${(error as Error).message}`);
    }
  }

  private async runInitialSync(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    this.logger.log('Starting initial relay population...');
    
    try {
      // 1. Sync notable accounts
      this.logger.log(`Syncing ${NOTABLE_PUBKEYS.length} notable accounts...`);
      for (const pubkey of NOTABLE_PUBKEYS) {
        await this.syncUserComplete(pubkey, RetentionPolicy.PRIORITY);
        await this.sleep(500); // Rate limit
      }
      
      // 2. Sync trending content (last 24h)
      this.logger.log('Syncing trending content...');
      const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      
      const trending = await this.pool.querySync(SOURCE_RELAYS, {
        kinds: [1],
        since,
        limit: 200,
      });
      
      let trendingSynced = 0;
      for (const event of trending) {
        try {
          await this.pool.publish([LOCAL_RELAY], event);
          trendingSynced++;
        } catch {
          // Ignore
        }
      }
      
      this.logger.log(`Synced ${trendingSynced} trending notes`);
      
      // 3. Run priority sync for any configured priority pubkeys
      await this.syncPriorityPubkeys();
      
      this.logger.log('Initial sync complete!');
    } finally {
      this.isRunning = false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async hasCapacity(): Promise<boolean> {
    const storage = await this.retentionCleanup.getStorageStats();
    return !storage.pressure;
  }
}
