import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { NostrAdminGuard } from '../auth/nostr-role.guard';
import { Nip05MarketplaceService } from './nip05-marketplace.service';

@ApiTags('nip05-marketplace')
@Controller('api/v1/nip05/marketplace')
export class Nip05MarketplaceController {
  constructor(private readonly service: Nip05MarketplaceService) {}

  @Get('availability/:name')
  @ApiOperation({ summary: 'Check NIP-05 availability including reserved / auction / listing rules' })
  checkAvailability(@Param('name') name: string, @Query('domain') domain = 'nostrmaxi.com') {
    return this.service.checkAvailability(name, domain);
  }

  @Get()
  @ApiOperation({ summary: 'Marketplace overview: auctions, premium flat-price listings, resale listings' })
  listMarketplace(@Query('q') q?: string, @Query('type') type?: string) {
    return this.service.listMarketplace({ q, type });
  }

  @Get('reserved')
  @ApiOperation({ summary: 'List reserved/restricted names' })
  listReserved() {
    return this.service.listReservedNames();
  }

  @Post('auctions')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  createAuction(@Body() body: any) {
    return this.service.createAuction(body);
  }

  @Post('auctions/:auctionId/bid')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  placeBid(@Param('auctionId') auctionId: string, @Body() body: { amountSats: number }, @Req() req: any) {
    return this.service.placeBid({ auctionId, amountSats: body.amountSats, bidderPubkey: req.pubkey });
  }

  @Post('auctions/:auctionId/finalize')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  finalizeAuction(@Param('auctionId') auctionId: string) {
    return this.service.finalizeAuction(auctionId);
  }

  @Post('listings')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  createListing(@Body() body: any, @Req() req: any) {
    return this.service.createListing({ ...body, sellerPubkey: req.pubkey });
  }

  @Post('listings/:listingId/buy')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  buyListing(@Param('listingId') listingId: string, @Req() req: any) {
    return this.service.buyListing({ listingId, buyerPubkey: req.pubkey });
  }

  @Patch('seller/lightning-address')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  setLightningAddress(@Req() req: any, @Body() body: { lightningAddress: string }) {
    return this.service.setSellerLightningAddress(req.pubkey, body.lightningAddress);
  }

  @Post('admin/transactions/:transactionId/retry-payout')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  retryPayout(@Param('transactionId') transactionId: string) {
    return this.service.adminRetryPayout(transactionId);
  }

  @Get('admin/transactions')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  listTransactions(@Query('limit') limit?: string) {
    return this.service.getMarketplaceTransactionHistory(limit ? parseInt(limit, 10) : 100);
  }
}
