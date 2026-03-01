import { Body, Controller, Delete, Get, Param, Put, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Prisma } from '@prisma/client';
import { AdminService } from './admin.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { RelayDiscoveryService } from '../relay-discovery/relay-discovery.service';
import { EcosystemCatalogService } from '../ecosystem-catalog/ecosystem-catalog.service';

interface ConfigMutationDto {
  value: unknown;
  type?: 'string' | 'number' | 'boolean' | 'json' | 'array';
  category?: string;
  description?: string;
}

@ApiTags('admin')
@Controller('api/v1/admin')
@UseGuards(NostrJwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private readonly appConfig: ConfigService,
    private readonly prisma: PrismaService,
    private readonly relayDiscovery: RelayDiscoveryService,
    private readonly ecosystemCatalog: EcosystemCatalogService,
  ) {}

  @Get('stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiBearerAuth()
  async listUsers(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listUsers(page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('nip05')
  async listNip05(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('username') username?: string,
    @Query('pubkey') pubkey?: string,
    @Query('domain') domain?: string,
  ) {
    return this.adminService.listNip05Registrations({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      username,
      pubkey,
      domain,
    });
  }

  @Get('nip05/:id')
  async getNip05(@Param('id') id: string) {
    return this.adminService.getNip05Registration(id);
  }

  @Put('nip05/:id')
  async updateNip05(@Req() req: any, @Param('id') id: string, @Body() body: { tier?: string; extendDays?: number }) {
    const result = await this.adminService.updateNip05Registration(id, body);
    await this.adminService.logAdminAction(req.pubkey, 'nip05.update', id, body);
    return result;
  }

  @Delete('nip05/:id')
  async deleteNip05(@Req() req: any, @Param('id') id: string) {
    const result = await this.adminService.deleteNip05Registration(id);
    await this.adminService.logAdminAction(req.pubkey, 'nip05.delete', id);
    return result;
  }

  @Post('nip05/:id/suspend')
  async suspendNip05(@Req() req: any, @Param('id') id: string, @Body() body: { suspended?: boolean }) {
    const suspended = body.suspended ?? true;
    const result = await this.adminService.suspendNip05Registration(id, suspended);
    await this.adminService.logAdminAction(req.pubkey, suspended ? 'nip05.suspend' : 'nip05.unsuspend', id, body);
    return result;
  }

  @Post('nip05/:id/transfer')
  async transferNip05(@Req() req: any, @Param('id') id: string, @Body() body: { pubkey: string }) {
    const result = await this.adminService.transferNip05Registration(id, body.pubkey);
    await this.adminService.logAdminAction(req.pubkey, 'nip05.transfer', id, body);
    return result;
  }

  @Get('names/reserved')
  getReserved(@Query('search') search?: string) {
    return this.adminService.getNameList('reserved', search);
  }

  @Post('names/reserved')
  async addReserved(@Req() req: any, @Body() body: { name: string; reason?: string }) {
    const result = await this.adminService.addNameToList('reserved', body);
    await this.adminService.logAdminAction(req.pubkey, 'names.reserved.add', result.id, body);
    return result;
  }

  @Delete('names/reserved/:name')
  async removeReserved(@Req() req: any, @Param('name') name: string) {
    const result = await this.adminService.removeNameFromList('reserved', name);
    await this.adminService.logAdminAction(req.pubkey, 'names.reserved.remove', name);
    return result;
  }

  @Get('names/premium')
  getPremium(@Query('search') search?: string) {
    return this.adminService.getNameList('premium', search);
  }

  @Post('names/premium')
  async addPremium(@Req() req: any, @Body() body: { name: string; reason?: string; minimumPrice?: number }) {
    const result = await this.adminService.addNameToList('premium', body);
    await this.adminService.logAdminAction(req.pubkey, 'names.premium.add', result.id, body);
    return result;
  }

  @Delete('names/premium/:name')
  async removePremium(@Req() req: any, @Param('name') name: string) {
    const result = await this.adminService.removeNameFromList('premium', name);
    await this.adminService.logAdminAction(req.pubkey, 'names.premium.remove', name);
    return result;
  }

  @Get('names/blocked')
  getBlocked(@Query('search') search?: string) {
    return this.adminService.getNameList('blocked', search);
  }

  @Post('names/blocked')
  async addBlocked(@Req() req: any, @Body() body: { name: string; reason?: string }) {
    const result = await this.adminService.addNameToList('blocked', body);
    await this.adminService.logAdminAction(req.pubkey, 'names.blocked.add', result.id, body);
    return result;
  }

  @Delete('names/blocked/:name')
  async removeBlocked(@Req() req: any, @Param('name') name: string) {
    const result = await this.adminService.removeNameFromList('blocked', name);
    await this.adminService.logAdminAction(req.pubkey, 'names.blocked.remove', name);
    return result;
  }

  @Post('names/import')
  async importNames(@Req() req: any, @Body() body: { list: 'reserved' | 'premium' | 'blocked'; format?: 'json' | 'csv'; content: string }) {
    const result = await this.adminService.importNames(body);
    await this.adminService.logAdminAction(req.pubkey, 'names.import', body.list, { format: body.format, imported: result.imported });
    return result;
  }

  @Get('names/export/:list')
  exportNames(@Param('list') list: 'reserved' | 'premium' | 'blocked', @Query('format') format?: 'json' | 'csv') {
    return this.adminService.exportNames(list, format || 'json');
  }

  @Get('auctions')
  listAuctions(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.adminService.listAuctions({ page: page ? parseInt(page, 10) : undefined, limit: limit ? parseInt(limit, 10) : undefined, status });
  }

  @Get('auctions/:id')
  getAuction(@Param('id') id: string) {
    return this.adminService.getAuction(id);
  }

  @Put('auctions/:id')
  async updateAuction(@Req() req: any, @Param('id') id: string, @Body() body: { startsAt?: number; endsAt?: number; reservePriceSats?: number; startingPriceSats?: number }) {
    const result = await this.adminService.updateAuction(id, body);
    await this.adminService.logAdminAction(req.pubkey, 'auction.update', id, body);
    return result;
  }

  @Post('auctions/:id/extend')
  async extendAuction(@Req() req: any, @Param('id') id: string, @Body() body: { extendSeconds: number }) {
    const result = await this.adminService.extendAuction(id, body.extendSeconds || 3600);
    await this.adminService.logAdminAction(req.pubkey, 'auction.extend', id, body);
    return result;
  }

  @Post('auctions/:id/cancel')
  async cancelAuction(@Req() req: any, @Param('id') id: string) {
    const result = await this.adminService.cancelAuction(id);
    await this.adminService.logAdminAction(req.pubkey, 'auction.cancel', id);
    return result;
  }

  @Post('auctions/:id/finalize')
  async finalizeAuction(@Req() req: any, @Param('id') id: string) {
    const result = await this.adminService.finalizeAuction(id);
    await this.adminService.logAdminAction(req.pubkey, 'auction.finalize', id);
    return result;
  }

  @Get('auctions/:id/bids')
  getAuctionBids(@Param('id') id: string) {
    return this.adminService.getAuctionBids(id);
  }

  @Get('sales/summary')
  salesSummary() {
    return this.adminService.salesSummary();
  }

  @Get('sales/revenue')
  salesRevenue(@Query('days') days?: string) {
    return this.adminService.salesRevenue(days ? parseInt(days, 10) : 30);
  }

  @Get('sales/transactions')
  salesTransactions(@Query('limit') limit?: string) {
    return this.adminService.salesTransactions(limit ? parseInt(limit, 10) : 50);
  }

  @Get('sales/subscriptions')
  salesSubscriptions() {
    return this.adminService.salesSubscriptions();
  }

  @Get('audit')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLog(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getAuditLog(page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('payments')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getPayments(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.getPayments(page ? parseInt(page, 10) : undefined, limit ? parseInt(limit, 10) : undefined);
  }

  @Get('config')
  async getConfig() {
    return this.appConfig.getAll();
  }

  @Get('config/key/:key')
  async getConfigByKey(@Param('key') key: string) {
    return { key, value: await this.appConfig.get(key) };
  }

  @Get('config/:category')
  async getConfigCategory(@Param('category') category: string) {
    return this.appConfig.getCategory(category);
  }

  @Put('config/:key')
  async putConfig(@Req() req: { params: { key: string }; npub?: string }, @Body() body: ConfigMutationDto) {
    const { key } = req.params;
    const existing = await this.prisma.config.findUnique({ where: { key } });
    const type = body.type ?? (existing?.type as ConfigMutationDto['type']) ?? (Array.isArray(body.value) ? 'array' : typeof body.value === 'boolean' ? 'boolean' : typeof body.value === 'number' ? 'number' : typeof body.value === 'string' ? 'string' : 'json');
    const category = body.category ?? existing?.category ?? key.split('.')[0] ?? 'general';
    const description = body.description ?? existing?.description ?? '';

    await this.appConfig.upsert(key, body.value, type, category, description, req.npub);

    await this.prisma.auditLog.create({
      data: {
        action: 'config.update',
        entity: 'Config',
        entityId: key,
        actorPubkey: req.npub,
        details: JSON.parse(JSON.stringify({
          value: body.value,
          type: body.type,
          category: body.category,
          description: body.description,
        })) as Prisma.InputJsonValue,
      },
    });

    return { ok: true };
  }

  @Delete('config/:key')
  async deleteConfig(@Req() req: { params: { key: string }; npub?: string }) {
    const { key } = req.params;
    await this.appConfig.delete(key);
    await this.prisma.auditLog.create({
      data: {
        action: 'config.delete',
        entity: 'Config',
        entityId: key,
        actorPubkey: req.npub,
      },
    });
    return { ok: true };
  }

  @Post('config/seed')
  async seedConfig(@Req() req: { npub?: string }) {
    const result = await this.appConfig.seedDefaults(req.npub || 'system');
    await this.prisma.auditLog.create({
      data: {
        action: 'config.seed',
        entity: 'Config',
        actorPubkey: req.npub,
        details: result,
      },
    });
    return result;
  }

  @Post('discover/relays')
  async discoverRelays(@Req() req: { npub?: string }) {
    const popular = this.relayDiscovery.getPopularRelays(20).map((relay) => relay.url);
    if (popular.length > 0) {
      await this.appConfig.set('relays.discovery', popular, req.npub);
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'config.discover.relays',
        entity: 'Config',
        entityId: 'relays.discovery',
        actorPubkey: req.npub,
        details: { count: popular.length },
      },
    });

    return { ok: true, count: popular.length, relays: popular };
  }

  @Post('discover/blossom')
  async discoverBlossom(@Req() req: { npub?: string }) {
    const list = await this.ecosystemCatalog.list({ category: 'infrastructure', subcategory: 'media servers' });
    const servers = list.entries
      .filter((entry) => entry.tags.includes('blossom'))
      .slice(0, 20)
      .map((entry, index) => ({
        url: entry.url,
        name: entry.name,
        priority: index + 1,
        requiresAuth: false,
      }));

    if (servers.length > 0) {
      await this.appConfig.set('blossom.servers', servers, req.npub);
    }

    await this.prisma.auditLog.create({
      data: {
        action: 'config.discover.blossom',
        entity: 'Config',
        entityId: 'blossom.servers',
        actorPubkey: req.npub,
        details: { count: servers.length },
      },
    });

    return { ok: true, count: servers.length, servers };
  }
}
