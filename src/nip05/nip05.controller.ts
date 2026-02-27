import { Controller, Get, Post, Delete, Query, Param, Body, UseGuards, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Nip05Service } from './nip05.service';
import { ProvisionNip05Dto, DeleteNip05Dto, LookupQueryDto, RegisterNip05Dto, BatchRegisterNip05Dto } from './dto/nip05.dto';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Request } from 'express';
import { nip19 } from 'nostr-tools';
import { WebhooksService } from '../webhooks/webhooks.service';

@ApiTags('nip05')
@Controller()
export class Nip05Controller {
  constructor(
    private nip05Service: Nip05Service,
    private authService: AuthService,
    private webhooks: WebhooksService,
  ) {}

  private async resolvePubkey(req: Request, authHeader: string, method: string): Promise<string> {
    const fromGuard = (req as any).pubkey;
    if (fromGuard) return fromGuard;

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.authService.verifyAuth(authHeader, method, url);
  }

  @Get('.well-known/nostr.json')
  @ApiOperation({ summary: 'NIP-05 lookup (standard endpoint)' })
  @ApiQuery({ name: 'name', required: true, description: 'Local part of NIP-05 address' })
  @ApiResponse({ status: 200, description: 'NIP-05 response' })
  @ApiResponse({ status: 404, description: 'Identity not found' })
  async wellKnown(@Query() query: LookupQueryDto) {
    return this.nip05Service.lookup(query.name);
  }

  @Get('api/v1/nip05/mine/unified')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List managed + external NIP-05 identities for the authenticated user' })
  async listUnified(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'GET');
    return this.nip05Service.getUnifiedIdentities(pubkey);
  }

  @Get('api/v1/nip05/verify-address/:address')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify a NIP-05 address against its domain record' })
  async verifyAddress(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Param('address') address: string,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'GET');
    return this.nip05Service.verifyAddress(address, pubkey);
  }

  @Get('api/v1/nip05/:address')
  @ApiOperation({ summary: 'Lookup NIP-05 by address' })
  @ApiResponse({ status: 200, description: 'NIP-05 details' })
  async lookup(@Param('address') address: string) {
    const [localPart, domain] = address.split('@');
    return this.nip05Service.lookup(localPart, domain);
  }

  @Post('api/v1/nip05/provision')
  @UseGuards(NostrJwtAuthGuard, RateLimitGuard)
  @ApiBearerAuth()
  async provision(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Body() dto: ProvisionNip05Dto,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'POST');
    return this.nip05Service.provision(pubkey, dto.localPart, dto.domain);
  }

  @Post('api/v1/nip05/register')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Agent-friendly NIP-05 registration by address and npub' })
  async register(@Body() dto: RegisterNip05Dto) {
    const [localPart, domain] = dto.address.split('@');
    const decoded = dto.npub.startsWith('npub1') ? (nip19.decode(dto.npub).data as string) : dto.npub;

    const result = await this.nip05Service.provision(decoded, localPart, domain);
    await this.webhooks.emit('subscription.changed', {
      type: 'nip05.registered',
      npub: dto.npub,
      address: result.address,
      pubkey: result.pubkey,
    }, dto.callbackUrl);

    return result;
  }

  @Post('api/v1/nip05/batch-register')
  @ApiOperation({ summary: 'Batch register multiple NIP-05 addresses' })
  async batchRegister(@Body() dto: BatchRegisterNip05Dto) {
    const results = await Promise.all(dto.registrations.map((r) => this.register(r)));
    return { count: results.length, results };
  }

  @Delete('api/v1/nip05')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  async delete(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Body() dto: DeleteNip05Dto,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'DELETE');
    return this.nip05Service.delete(pubkey, dto.localPart, dto.domain);
  }

  @Get('api/v1/nip05/mine')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  async listMine(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'GET');
    return this.nip05Service.listByPubkey(pubkey);
  }

  @Post('api/v1/nip05/verify/:domain')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  async verifyDomain(
    @Headers('authorization') _authHeader: string,
    @Req() req: Request,
    @Param('domain') domain: string,
  ) {
    const pubkey = await this.resolvePubkey(req, _authHeader, 'POST');
    return this.nip05Service.verifyDomain(pubkey, domain);
  }
}
