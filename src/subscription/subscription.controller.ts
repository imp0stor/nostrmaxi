import { Controller, Get, Post, Body, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionService } from './subscription.service';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';
import { UpgradeSubscriptionDto } from './dto/subscription.dto';

@ApiTags('subscriptions')
@Controller('api/v1/subscription')
export class SubscriptionController {
  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
  ) {}

  @Get('tiers')
  @ApiOperation({ summary: 'Get available subscription tiers' })
  @ApiResponse({ status: 200, description: 'List of tiers with features and pricing' })
  getTiers() {
    return this.subscriptionService.getTiers();
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, description: 'Current subscription details' })
  async getCurrent(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    return this.subscriptionService.getCurrentSubscription(pubkey);
  }

  @Post('upgrade')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upgrade subscription (creates payment invoice)' })
  @ApiResponse({ status: 201, description: 'Payment invoice created' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  async upgrade(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Body() body: UpgradeSubscriptionDto,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.subscriptionService.upgrade(pubkey, body.tier, body.applyWotDiscount ?? true);
  }

  @Post('downgrade')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Schedule downgrade to free tier at end of billing period' })
  @ApiResponse({ status: 200, description: 'Downgrade scheduled' })
  async downgrade(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.subscriptionService.downgrade(pubkey);
  }

  @Post('cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancel(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.subscriptionService.cancel(pubkey);
  }

  @Post('reactivate')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate a cancelled subscription' })
  @ApiResponse({ status: 200, description: 'Subscription reactivated' })
  async reactivate(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.subscriptionService.reactivate(pubkey);
  }
}
