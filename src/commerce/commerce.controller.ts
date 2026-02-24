import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CommerceService } from './commerce.service';
import { NostrAuthGuard } from '../auth/nostr-auth.guard';
import { CreateInvoiceDto } from './dto/commerce.dto';

@ApiTags('commerce')
@Controller('api/v1/commerce')
export class CommerceController {
  constructor(private commerceService: CommerceService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get all products' })
  @ApiResponse({ status: 200, description: 'Product catalog retrieved successfully' })
  async getProducts() {
    return {
      products: this.commerceService.getProducts(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async getProduct(@Param('id') id: string) {
    const product = this.commerceService.getProduct(id);
    if (!product) {
      return { error: 'Product not found' };
    }
    return product;
  }

  @Get('products/tier/:tier')
  @ApiOperation({ summary: 'Get products by tier' })
  @ApiParam({ name: 'tier', description: 'Tier name (FREE, PRO, BUSINESS, LIFETIME)' })
  @ApiResponse({ status: 200, description: 'Products for tier' })
  async getProductsByTier(@Param('tier') tier: string) {
    return {
      tier,
      products: this.commerceService.getProductsByTier(tier.toUpperCase()),
    };
  }

  @Get('config')
  @ApiOperation({ summary: 'Get commerce configuration' })
  @ApiResponse({ status: 200, description: 'Commerce configuration' })
  async getConfig() {
    return this.commerceService.getConfig();
  }

  @Get('payment-methods')
  @ApiOperation({ summary: 'Get available payment methods and features' })
  @ApiResponse({ status: 200, description: 'Payment method features' })
  async getPaymentMethods() {
    return this.commerceService.getPaymentMethodFeatures();
  }

  @Get('provider-status')
  @ApiOperation({ summary: 'Get payment provider status' })
  @ApiResponse({ status: 200, description: 'Payment provider health status' })
  async getProviderStatus() {
    return this.commerceService.getProviderStatus();
  }

  @Post('invoice/create')
  @UseGuards(NostrAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment invoice' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'Product ID to purchase' },
        metadata: { type: 'object', description: 'Optional metadata' },
      },
      required: ['productId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid product' })
  async createInvoice(@Body() body: CreateInvoiceDto) {
    return this.commerceService.createBTCPayInvoice(body.productId, body.metadata);
  }

  @Get('pricing/:productId/:pubkey')
  @ApiOperation({ summary: 'Calculate pricing with WoT discount' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiParam({ name: 'pubkey', description: 'User pubkey (hex or npub)' })
  @ApiResponse({ status: 200, description: 'Pricing breakdown with discount' })
  async calculatePricing(@Param('productId') productId: string, @Param('pubkey') pubkey: string) {
    let hexPubkey = pubkey;
    if (pubkey.startsWith('npub1')) {
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(pubkey);
      hexPubkey = decoded.data as string;
    }
    return this.commerceService.calculatePricingWithDiscount(productId, hexPubkey);
  }
}
