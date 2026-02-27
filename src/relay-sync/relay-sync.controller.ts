import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { RelaySyncService } from './relay-sync.service';

@Controller('api/v1/relay-sync')
export class RelaySyncController {
  constructor(private readonly relaySyncService: RelaySyncService) {}

  @Get('stats')
  getStats() {
    return this.relaySyncService.getStats();
  }

  @Post('trigger')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync() {
    // Fire and forget - don't wait for sync to complete
    setImmediate(() => this.relaySyncService.syncOnce());
    return { message: 'Sync triggered' };
  }
}
