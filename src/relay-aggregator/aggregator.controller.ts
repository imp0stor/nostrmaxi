import { Controller, Post, Get, Query } from '@nestjs/common';
import { AggregatorService } from './aggregator.service';

@Controller('api/aggregator')
export class AggregatorController {
  constructor(private readonly aggregator: AggregatorService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'running',
      message: 'Aggregator service is active',
    };
  }

  @Post('sync')
  async triggerSync(@Query('pubkey') pubkey?: string) {
    if (pubkey) {
      await this.aggregator.syncSingleUser(pubkey);
      return { status: 'ok', message: `Synced user ${pubkey.slice(0, 8)}...` };
    }
    
    // Trigger full sync in background
    this.aggregator.triggerManualSync();
    return { status: 'ok', message: 'Manual sync triggered' };
  }

  @Post('sync-wot')
  async syncWot(@Query('pubkey') pubkey: string) {
    if (!pubkey) {
      return { status: 'error', message: 'pubkey required' };
    }
    
    await this.aggregator.syncUserWot(pubkey);
    return { status: 'ok', message: `WoT sync started for ${pubkey.slice(0, 8)}...` };
  }
}
