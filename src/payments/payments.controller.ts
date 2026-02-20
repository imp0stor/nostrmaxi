import { Controller, Get, Post, Body, Headers, Req, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService, SubscriptionTier } from './payments.service';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';
import { PaymentProviderType } from './providers';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private authService: AuthService,
  ) {}

  @Get('tiers')
  @ApiOperation({ summary: 'Get available subscription tiers and pricing' })
  @ApiResponse({ status: 200, description: 'List of subscription tiers' })
  getTiers() {
    return this.paymentsService.getTiers();
  }

  @Post('invoice')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Lightning invoice for subscription' })
  @ApiResponse({ status: 201, description: 'Invoice created' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createInvoice(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Body() body: { tier: SubscriptionTier; applyWotDiscount?: boolean; billingCycle?: 'monthly' | 'annual' | 'lifetime' },
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    
    return this.paymentsService.createInvoice(
      pubkey,
      body.tier,
      body.applyWotDiscount ?? true,
      body.billingCycle || 'monthly',
    );
  }

  @Get('invoice/:id')
  @ApiOperation({ summary: 'Check invoice payment status' })
  @ApiResponse({ status: 200, description: 'Invoice status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async checkInvoice(@Param('id') id: string) {
    return this.paymentsService.checkInvoiceStatus(id);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Payment webhook handler (called by providers)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment history' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Payment history' })
  async getHistory(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    
    return this.paymentsService.getPaymentHistory(pubkey, limit ? parseInt(limit) : 20);
  }

  @Get('receipt/:paymentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment receipt' })
  @ApiResponse({ status: 200, description: 'Payment receipt' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getReceipt(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Param('paymentId') paymentId: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    
    return this.paymentsService.getReceipt(pubkey, paymentId);
  }
}
