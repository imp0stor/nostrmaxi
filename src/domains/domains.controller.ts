import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CreateDomainDto, CreateSiteDto, UpdateDomainLightningDto, UpdateSiteDto } from './dto/domain.dto';
import { DomainsService } from './domains.service';

@ApiTags('domains')
@Controller()
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    private readonly authService: AuthService,
  ) {}

  private async resolvePubkey(req: Request, authHeader: string, method: string): Promise<string> {
    const fromGuard = (req as any).pubkey;
    if (fromGuard) return fromGuard;

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.authService.verifyAuth(authHeader, method, url);
  }

  @Get('api/v1/domains')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  listDomains(@Headers('authorization') _auth: string, @Req() req: Request) {
    return this.resolvePubkey(req, _auth, 'GET').then((pubkey) => this.domainsService.listDomains(pubkey));
  }

  @Post('api/v1/domains')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a custom domain and generate verification token' })
  createDomain(
    @Headers('authorization') _auth: string,
    @Req() req: Request,
    @Body() body: CreateDomainDto,
  ) {
    return this.resolvePubkey(req, _auth, 'POST').then((pubkey) => this.domainsService.createDomain(pubkey, body));
  }

  @Post('api/v1/domains/:id/verify')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  verifyDomain(@Headers('authorization') _auth: string, @Req() req: Request, @Param('id') id: string) {
    return this.resolvePubkey(req, _auth, 'POST').then((pubkey) => this.domainsService.verifyDomain(pubkey, id));
  }

  @Patch('api/v1/domains/:id/lightning-name')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  setLightningName(
    @Headers('authorization') _auth: string,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateDomainLightningDto,
  ) {
    return this.resolvePubkey(req, _auth, 'PATCH').then((pubkey) => this.domainsService.setLightningName(pubkey, id, body.lightningName));
  }

  @Delete('api/v1/domains/:id')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  deleteDomain(@Headers('authorization') _auth: string, @Req() req: Request, @Param('id') id: string) {
    return this.resolvePubkey(req, _auth, 'DELETE').then((pubkey) => this.domainsService.deleteDomain(pubkey, id));
  }

  @Get('api/v1/domains/:id/analytics')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  getAnalytics(@Headers('authorization') _auth: string, @Req() req: Request, @Param('id') id: string) {
    return this.resolvePubkey(req, _auth, 'GET').then((pubkey) => this.domainsService.getAnalytics(pubkey, id));
  }

  @Get('api/v1/domains/:domainId/site')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  getSite(@Headers('authorization') _auth: string, @Req() req: Request, @Param('domainId') domainId: string) {
    return this.resolvePubkey(req, _auth, 'GET').then((pubkey) => this.domainsService.getSite(pubkey, domainId));
  }

  @Post('api/v1/domains/:domainId/site')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  createSite(
    @Headers('authorization') _auth: string,
    @Req() req: Request,
    @Param('domainId') domainId: string,
    @Body() body: CreateSiteDto,
  ) {
    return this.resolvePubkey(req, _auth, 'POST').then((pubkey) => this.domainsService.upsertSite(pubkey, domainId, body));
  }

  @Patch('api/v1/domains/:domainId/site')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  updateSite(
    @Headers('authorization') _auth: string,
    @Req() req: Request,
    @Param('domainId') domainId: string,
    @Body() body: UpdateSiteDto,
  ) {
    return this.resolvePubkey(req, _auth, 'PATCH').then((pubkey) => this.domainsService.upsertSite(pubkey, domainId, body));
  }

  @Delete('api/v1/domains/:domainId/site')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  deleteSite(@Headers('authorization') _auth: string, @Req() req: Request, @Param('domainId') domainId: string) {
    return this.resolvePubkey(req, _auth, 'DELETE').then((pubkey) => this.domainsService.deleteSite(pubkey, domainId));
  }

  @Get('.well-known/lnurlp/:name')
  @ApiOperation({ summary: 'LNURL proxy for verified BYOD domain' })
  lnurlProxy(@Headers('host') host: string, @Param('name') name: string) {
    return this.domainsService.resolveLnurl(host, name);
  }

  @Get('api/v1/domain-site')
  @ApiOperation({ summary: 'Resolve hosted site template by Host header and increment views' })
  resolveSite(@Headers('host') host: string) {
    return this.domainsService.resolveSiteByHost(host);
  }
}
