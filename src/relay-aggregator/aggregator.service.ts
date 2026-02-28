import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { type Event as NostrEvent } from 'nostr-tools';
import { NoiseFilterService } from '../sync/noise-filter.service';
import { RetentionPolicy, SyncPriorityService, SyncTier } from '../sync/sync-priority.service';
import { RetentionCleanupService } from '../sync/retention-cleanup.service';
import { IngestionService } from './ingestion.service';
import { TrendingService } from './trending.service';

@Injectable()
export class AggregatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AggregatorService.name);
  private prioritySyncTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly syncPriority: SyncPriorityService,
    private readonly noiseFilter: NoiseFilterService,
    private readonly ingestion: IngestionService,
    private readonly trending: TrendingService,
    private readonly retentionCleanup: RetentionCleanupService,
  ) {}

  onModuleInit(): void {
    // Every 6 hours.
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
    this.logger.debug(`Priority sync queued for ${pubkey} (${retention})`);
  }

  private async hasCapacity(): Promise<boolean> {
    const storage = await this.retentionCleanup.getStorageStats();
    return !storage.pressure;
  }
}
