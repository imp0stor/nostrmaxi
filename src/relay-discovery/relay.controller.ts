import { Controller, Get, Param, Query } from '@nestjs/common';
import { RelayDiscoveryService } from './relay-discovery.service';
import { WotRelayService } from './wot-relay.service';

@Controller('api/relays')
export class RelayController {
  constructor(
    private readonly relayDiscovery: RelayDiscoveryService,
    private readonly wotRelay: WotRelayService,
  ) {}

  @Get('stats')
  async getRelayStats() {
    const discovered = this.relayDiscovery.getDiscoveredRelays();
    const online = discovered.filter((r) => r.isOnline === true).length;

    return {
      totalDiscovered: discovered.length,
      online,
      offline: discovered.filter((r) => r.isOnline === false).length,
      popular: this.relayDiscovery.getPopularRelays(20),
    };
  }

  @Get('suggestions')
  async getRelaySuggestions(@Query('pubkey') pubkey: string) {
    const wotRelays = await this.wotRelay.getRelaysForWot(pubkey);
    const bestWrite = await this.wotRelay.getBestWriteRelays(pubkey, 5);
    const bestRead = await this.wotRelay.getBestReadRelays(pubkey, 5);

    return {
      recommended: wotRelays.slice(0, 10),
      forWriting: bestWrite,
      forReading: bestRead,
      reason: 'Based on relays used by people you follow',
    };
  }

  @Get(':url')
  async getRelayInfo(@Param('url') url: string) {
    const decoded = decodeURIComponent(url);
    const relay = this.relayDiscovery.getDiscoveredRelays().find((r) => r.url === decoded);

    return {
      relay: decoded,
      found: !!relay,
      stats: relay || null,
    };
  }
}
