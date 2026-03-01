import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminMarketplaceService } from './admin-marketplace.service';

@ApiTags('admin-marketplace')
@ApiBearerAuth()
@Controller('api/v1/admin/marketplace')
@UseGuards(NostrJwtAuthGuard, AdminGuard)
export class AdminMarketplaceController {
  constructor(
    private readonly service: AdminMarketplaceService,
    private readonly adminService: AdminService,
  ) {}

  @Get('reserved-names')
  listReserved(@Query('q') q?: string) { return this.service.listNames('reserved', q); }

  @Post('reserved-names')
  async createReserved(@Req() req: any, @Body() body: any) {
    const result = await this.service.createName('reserved', body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.reserved.create', result.id, body);
    return result;
  }

  @Patch('reserved-names/:id')
  async patchReserved(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const result = await this.service.updateName('reserved', id, body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.reserved.patch', id, body);
    return result;
  }

  @Delete('reserved-names/:id')
  async deleteReserved(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.deleteName('reserved', id);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.reserved.delete', id);
    return result;
  }

  @Get('premium-names')
  listPremium(@Query('q') q?: string) { return this.service.listNames('premium', q); }

  @Post('premium-names')
  async createPremium(@Req() req: any, @Body() body: any) {
    const result = await this.service.createName('premium', body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.premium.create', result.id, body);
    return result;
  }

  @Patch('premium-names/:id')
  async patchPremium(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const result = await this.service.updateName('premium', id, body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.premium.patch', id, body);
    return result;
  }

  @Delete('premium-names/:id')
  async deletePremium(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.deleteName('premium', id);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.premium.delete', id);
    return result;
  }

  @Get('blocked-names')
  listBlocked(@Query('q') q?: string) { return this.service.listNames('blocked', q); }

  @Post('blocked-names')
  async createBlocked(@Req() req: any, @Body() body: any) {
    const result = await this.service.createName('blocked', body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.blocked.create', result.id, body);
    return result;
  }

  @Patch('blocked-names/:id')
  async patchBlocked(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const result = await this.service.updateName('blocked', id, body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.blocked.patch', id, body);
    return result;
  }

  @Delete('blocked-names/:id')
  async deleteBlocked(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.deleteName('blocked', id);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.blocked.delete', id);
    return result;
  }

  @Post('names/bulk-import')
  async bulkImport(@Req() req: any, @Body() body: { category: 'reserved' | 'premium' | 'blocked'; content: string; minimumPrice?: number; reason?: string }) {
    const result = await this.service.bulkImport(body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.names.bulk-import', body.category, { imported: result.imported });
    return result;
  }

  @Get('auctions')
  listAuctions(@Query('status') status?: string) { return this.service.listAuctions(status); }

  @Post('auctions')
  async createAuction(@Req() req: any, @Body() body: any) {
    const result = await this.service.createAuction(body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.auctions.create', result.id, body);
    return result;
  }

  @Patch('auctions/:id')
  async patchAuction(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const result = await this.service.patchAuction(id, body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.auctions.patch', id, body);
    return result;
  }

  @Post('auctions/:id/cancel')
  async cancelAuction(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.cancelAuction(id);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.auctions.cancel', id);
    return result;
  }

  @Post('auctions/:id/settle')
  async settleAuction(@Req() req: any, @Param('id') id: string, @Body() body: { winnerPubkey?: string }) {
    const result = await this.service.settleAuction(id, body?.winnerPubkey);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.auctions.settle', id, body || {});
    return result;
  }

  @Get('listings')
  listListings(@Query('status') status?: string) { return this.service.listListings(status); }

  @Post('listings')
  async createListing(@Req() req: any, @Body() body: any) {
    const result = await this.service.createListing(body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.listings.create', result.id, body);
    return result;
  }

  @Patch('listings/:id')
  async patchListing(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const result = await this.service.patchListing(id, body);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.listings.patch', id, body);
    return result;
  }

  @Delete('listings/:id')
  async deleteListing(@Req() req: any, @Param('id') id: string) {
    const result = await this.service.deleteListing(id);
    await this.adminService.logAdminAction(req.pubkey, 'marketplace.listings.delete', id);
    return result;
  }

  @Get('transfers')
  listTransfers(@Query('status') status?: string) { return this.service.listTransfers(status); }
}
