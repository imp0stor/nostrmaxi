import { Controller, Get, Post, Body, Param, Query, UseGuards, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService, SubscriptionTier } from './payments.service';
import { PaymentProviderType } from './providers';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private authService: AuthService,
  ) {}

  private async resolvePubkey(req: Request, authHeader: string, method: string): Promise<string> {
    const fromGuard = (req as any).pubkey;
    if (fromGuard) return fromGuard;

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.authService.verifyAuth(authHeader, method, url);
  }

  @Get('tiers')
  @ApiOperation({ summary: 'Get available subscription tiers and pricing' })
  @ApiResponse({ status: 200, description: 'List of subscription tiers' })
  getTiers() {
    return this.paymentsService.getTiers();
  }

  @Post('invoice')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  async createInvoice(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Body() body: { tier: SubscriptionTier; applyWotDiscount?: boolean; billingCycle?: 'monthly' | 'annual' | 'lifetime' },
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'POST');

    return this.paymentsService.createInvoice(
      pubkey,
      body.tier,
      body.applyWotDiscount ?? true,
      body.billingCycle || 'monthly',
    );
  }

  @Get('invoice/:id')
  @ApiOperation({ summary: 'Check invoice payment status' })
  async checkInvoice(@Param('id') id: string) {
    return this.paymentsService.checkInvoiceStatus(id);
  }

  @Post('webhook')
  async handleWebhook(
    @Body() body: any,
    @Headers('btcpay-sig') btcpaySignature?: string,
    @Headers('x-webhook-signature') lnbitsSignature?: string,
    @Headers('x-payment-provider') providerHeader?: string,
    @Query('provider') providerQuery?: string,
  ) {
    const signature = btcpaySignature || lnbitsSignature;
    const providerType = (providerQuery || providerHeader) as PaymentProviderType | undefined;
    return this.paymentsService.handleWebhook(body, signature, providerType);
  }

  @Get('history')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'GET');
    return this.paymentsService.getPaymentHistory(pubkey, limit ? parseInt(limit) : 20);
  }

  @Get('receipt/:paymentId')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  async getReceipt(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Param('paymentId') paymentId: string,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'GET');
    return this.paymentsService.getReceipt(pubkey, paymentId);
  }
}
