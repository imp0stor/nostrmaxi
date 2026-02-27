import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { nip19 } from 'nostr-tools';
import { SubscriptionService } from './subscription.service';

@ApiTags('subscriptions')
@Controller('api/v1/subscriptions')
export class SubscriptionsAgentController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get(':npub')
  @ApiOperation({ summary: 'Agent-friendly endpoint: list subscriptions by npub/pubkey' })
  async getByNpub(@Param('npub') npub: string) {
    const pubkey = npub.startsWith('npub1') ? (nip19.decode(npub).data as string) : npub;
    return this.subscriptionService.getCurrentSubscription(pubkey);
  }
}
