import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { SubscriptionTier } from '../payments/payments.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NostrAdminGuard } from '../auth/nostr-role.guard';
import { nip19 } from 'nostr-tools';

@ApiTags('subscriptions')
@Controller('api/v1/subscription')
export class SubscriptionController {
  constructor(private subscriptionService: SubscriptionService) {}

  @Get('tiers')
  @ApiOperation({ summary: 'Get available subscription tiers' })
  @ApiResponse({ status: 200, description: 'List of tiers with features and pricing' })
  getTiers() {
    return this.subscriptionService.getTiers();
  }

  @Get()
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  async getCurrent(@CurrentUser() pubkey: string) {
    return this.subscriptionService.getCurrentSubscription(pubkey);
  }

  @Get('/list/:npub')
  @ApiOperation({ summary: 'Get subscription status for a given npub/pubkey' })
  @ApiResponse({ status: 200, description: 'Subscription details' })
  async getForNpub(@Param('npub') npub: string) {
    const pubkey = npub.startsWith('npub1') ? (nip19.decode(npub).data as string) : npub;
    return this.subscriptionService.getCurrentSubscription(pubkey);
  }

  @Get('entitlement/:npub')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: read user entitlement by npub/pubkey' })
  async getEntitlement(@Param('npub') npub: string) {
    const pubkey = npub.startsWith('npub1') ? (nip19.decode(npub).data as string) : npub;
    return this.subscriptionService.getEntitlement(pubkey);
  }

  @Post('entitlement/:npub')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: set user entitlement tier' })
  async setEntitlement(
    @Param('npub') npub: string,
    @CurrentUser() actorPubkey: string,
    @Body() body: { tier: SubscriptionTier },
  ) {
    const pubkey = npub.startsWith('npub1') ? (nip19.decode(npub).data as string) : npub;
    return this.subscriptionService.setEntitlement(pubkey, body.tier, actorPubkey);
  }

  @Post('upgrade')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade subscription (creates payment invoice)' })
  @ApiResponse({ status: 201, description: 'Payment invoice created' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  async upgrade(
    @CurrentUser() pubkey: string,
    @Body() body: { tier: SubscriptionTier; applyWotDiscount?: boolean },
  ) {
    return this.subscriptionService.upgrade(pubkey, body.tier, body.applyWotDiscount ?? true);
  }

  @Post('downgrade')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule downgrade to free tier at end of billing period' })
  @ApiResponse({ status: 200, description: 'Downgrade scheduled' })
  async downgrade(@CurrentUser() pubkey: string) {
    return this.subscriptionService.downgrade(pubkey);
  }

  @Post('cancel')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancel(@CurrentUser() pubkey: string) {
    return this.subscriptionService.cancel(pubkey);
  }

  @Post('reactivate')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a cancelled subscription' })
  @ApiResponse({ status: 200, description: 'Subscription reactivated' })
  async reactivate(@CurrentUser() pubkey: string) {
    return this.subscriptionService.reactivate(pubkey);
  }
}
