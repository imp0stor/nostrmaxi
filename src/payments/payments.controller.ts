import { Controller, Get, Post, Body, Headers, Req, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';
import { PaymentProviderType } from './providers';
import { CreateInvoiceDto } from './dto/payments.dto';

@ApiTags('payments')
@Controller('api/v1/payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

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
    @Body() body: CreateInvoiceDto,
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
  @ApiResponse({ status: 400, description: 'Invalid webhook payload or signature' })
  @ApiResponse({ status: 500, description: 'Webhook processing failed' })
  async handleWebhook(
    @Body() body: any,
    @Headers('btcpay-sig') btcpaySignature?: string,
    @Headers('x-webhook-signature') lnbitsSignature?: string,
    @Headers('x-payment-provider') providerHeader?: string,
    @Query('provider') providerQuery?: string,
  ) {
    const signature = btcpaySignature || lnbitsSignature;
    const providerType = (providerQuery || providerHeader) as PaymentProviderType | undefined;

    try {
      // Log webhook receipt (sanitized)
      this.logger.log(`Webhook received`, JSON.stringify({
        provider: providerType || 'unknown',
        hasSignature: !!signature,
        bodyKeys: Object.keys(body || {}),
        timestamp: new Date().toISOString(),
      }));

      const result = await this.paymentsService.handleWebhook(body, signature, providerType);
      
      this.logger.log(`Webhook processed`, JSON.stringify({
        provider: providerType,
        result,
      }));
      
      return result;
    } catch (error) {
      // Log error with context but don't expose sensitive details
      this.logger.error(`Webhook processing failed`, JSON.stringify({
        provider: providerType,
        error: error.message,
        stack: error.stack,
        bodyKeys: Object.keys(body || {}),
        hasSignature: !!signature,
      }));
      
      // Return generic error to webhook caller (don't leak internals)
      // But log detailed error for debugging
      throw error; // NestJS will handle response
    }
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
