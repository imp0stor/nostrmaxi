import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { statfs } from 'fs/promises';
import { resolve } from 'path';
import { SYNC_CONFIG } from './sync.config';

@Injectable()
export class RetentionCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionCleanupService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;

  onModuleInit(): void {
    // Daily cleanup job (3am equivalent cadence from startup).
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredContent().catch((error) => {
        this.logger.error(`Retention cleanup failed: ${(error as Error).message}`);
      });
    }, 24 * 60 * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async cleanupExpiredContent(): Promise<void> {
    const storage = await this.getStorageStats();

    // NOTE: We intentionally make no permanence guarantees.
    // Content may be filtered/removed for policy, legal, safety, or storage reasons.
    this.logger.log(
      `Retention cleanup scan complete (used=${storage.used}, total=${storage.total}, pressure=${storage.pressure})`,
    );

    if (storage.pressure) {
      this.logger.warn('Storage pressure detected: temporary and best-effort content should be pruned first.');
    }
  }

  async getStorageStats(): Promise<{ used: number; total: number; pressure: boolean }> {
    try {
      const targetPath = process.env.RELAY_DATA_PATH || resolve(process.cwd());
      const fsStats = await statfs(targetPath);
      const total = Number(fsStats.blocks) * Number(fsStats.bsize);
      const free = Number(fsStats.bfree) * Number(fsStats.bsize);
      const used = Math.max(0, total - free);
      const usedPercent = total > 0 ? (used / total) * 100 : 0;

      return {
        used,
        total,
        pressure: usedPercent >= SYNC_CONFIG.storageWarningPercent,
      };
    } catch {
      return { used: 0, total: 0, pressure: false };
    }
  }
}
