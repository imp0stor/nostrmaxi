import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NostrAdminGuard } from '../auth/nostr-role.guard';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { AuctionCreateInput } from './auction.types';
import { AuctionService } from './auction.service';

@ApiTags('auctions')
@Controller('api/v1/auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get()
  @ApiOperation({ summary: 'List active auctions' })
  @ApiResponse({ status: 200, description: 'Active auctions' })
  listActiveAuctions() {
    return this.auctionService.listActiveAuctions();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get auction details and bids' })
  @ApiResponse({ status: 200, description: 'Auction details' })
  getAuction(@Param('id') id: string) {
    return this.auctionService.getAuction(id);
  }

  @Post()
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create auction (admin only)' })
  @ApiResponse({ status: 201, description: 'Auction created' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  createAuction(@Body() body: AuctionCreateInput) {
    return this.auctionService.createAuction(body);
  }

  @Post(':id/settle')
  @UseGuards(NostrJwtAuthGuard, NostrAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Settle ended auction (admin only)' })
  @ApiResponse({ status: 200, description: 'Settlement result' })
  @ApiResponse({ status: 403, description: 'Admin access required' })
  settleAuction(@Param('id') id: string) {
    return this.auctionService.settleAuction(id);
  }
}
