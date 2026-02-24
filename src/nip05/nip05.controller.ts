import { Controller, Get, Post, Delete, Query, Param, Body, Headers, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Nip05Service } from './nip05.service';
import { NostrAuthGuard } from '../auth/nostr-auth.guard';
import { AuthService } from '../auth/auth.service';
import { Request } from 'express';
import { ProvisionNip05Dto, DeleteNip05Dto, LookupQueryDto } from './dto/nip05.dto';

@ApiTags('nip05')
@Controller()
export class Nip05Controller {
  constructor(
    private nip05Service: Nip05Service,
    private authService: AuthService,
  ) {}

  /**
   * Standard NIP-05 endpoint
   */
  @Get('.well-known/nostr.json')
  @ApiOperation({ summary: 'NIP-05 lookup (standard endpoint)' })
  @ApiQuery({ name: 'name', required: true, description: 'Local part of NIP-05 address' })
  @ApiResponse({ status: 200, description: 'NIP-05 response' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  async wellKnown(@Query() query: LookupQueryDto) {
    return this.nip05Service.lookup(query.name);
  }

  /**
   * Domain catalog endpoint
   */
  @Get('api/v1/nip05/domains')
  @ApiOperation({ summary: 'Get available NIP-05 domains catalog' })
  @ApiResponse({ status: 200, description: 'Domain catalog' })
  listDomains() {
    return this.nip05Service.getDomainCatalog();
  }

  /**
   * API lookup endpoint
   */
  @Get('api/v1/nip05/:address')
  @ApiOperation({ summary: 'Lookup NIP-05 by address' })
  @ApiResponse({ status: 200, description: 'NIP-05 details' })
  async lookup(@Param('address') address: string) {
    const [localPart, domain] = address.split('@');
    return this.nip05Service.lookup(localPart, domain);
  }

  /**
   * Provision new NIP-05
   */
  @Post('api/v1/nip05/provision')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Provision a new NIP-05 identity' })
  @ApiResponse({ status: 201, description: 'NIP-05 created' })
  @ApiResponse({ status: 403, description: 'NIP-05 limit reached for tier' })
  @ApiResponse({ status: 409, description: 'Address already taken' })
  async provision(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Body() dto: ProvisionNip05Dto,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.nip05Service.provision(pubkey, dto.localPart, dto.domain);
  }

  /**
   * Delete NIP-05
   */
  @Delete('api/v1/nip05')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a NIP-05 identity' })
  async delete(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Body() dto: DeleteNip05Dto,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'DELETE', url);
    return this.nip05Service.delete(pubkey, dto.localPart, dto.domain);
  }

  /**
   * List my NIP-05 identities
   */
  @Get('api/v1/nip05/mine')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my NIP-05 identities' })
  async listMine(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    return this.nip05Service.listByPubkey(pubkey);
  }

  /**
   * Verify custom domain
   */
  @Post('api/v1/nip05/verify/:domain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a custom domain' })
  async verifyDomain(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Param('domain') domain: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'POST', url);
    return this.nip05Service.verifyDomain(pubkey, domain);
  }

  /**
   * Check availability of NIP-05 address
   */
  @Get('api/v1/nip05/check-availability')
  @ApiOperation({ summary: 'Check if a NIP-05 address is available' })
  @ApiQuery({ name: 'localPart', required: true })
  @ApiQuery({ name: 'domain', required: false })
  @ApiResponse({ status: 200, description: 'Availability status' })
  async checkAvailability(
    @Query('localPart') localPart: string,
    @Query('domain') domain?: string,
  ) {
    return this.nip05Service.checkAvailability(localPart, domain);
  }
}
