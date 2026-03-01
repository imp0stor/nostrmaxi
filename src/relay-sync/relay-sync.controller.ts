import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { RelaySyncService } from './relay-sync.service';

@Controller('api/v1/relay-sync')
export class RelaySyncController {
  constructor(private readonly relaySyncService: RelaySyncService) {}

  @Get('status')
  getStatus() {
    return this.relaySyncService.getStatus();
  }

  @Get('stats')
  getStats() {
    return this.relaySyncService.getStats();
  }

  @Get('debug')
  getDebug() {
    return this.relaySyncService.getRateLimiterDebug();
  }

  @Post('start')
  @HttpCode(HttpStatus.ACCEPTED)
  async start() {
    return this.relaySyncService.start();
  }

  @Post('pause')
  @HttpCode(HttpStatus.ACCEPTED)
  async pause() {
    return this.relaySyncService.pause();
  }

  @Post('add-pubkey')
  @HttpCode(HttpStatus.ACCEPTED)
  async addPubkey(@Body() body: { pubkey: string }) {
    await this.relaySyncService.addPubkey(body.pubkey);
    return { queued: true, pubkey: body.pubkey };
  }
}
