import { Controller, Get, Post, Body, Headers, Req, Query, Delete, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthService, NostrAuthEvent } from './auth.service';
import { Request } from 'express';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // ============ Challenge-Response Auth (NIP-07) ============

  @Post('challenge')
  @ApiOperation({ summary: 'Generate authentication challenge for signing' })
  @ApiResponse({ status: 201, description: 'Challenge for signing with Nostr key' })
  async getChallenge(@Body() body: { pubkey?: string }) {
    return this.authService.generateChallenge(body.pubkey);
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify signed challenge and get JWT token' })
  @ApiResponse({ status: 200, description: 'JWT token and user profile' })
  @ApiResponse({ status: 401, description: 'Invalid signature or challenge' })
  async verifyChallenge(
    @Body() body: { event: NostrAuthEvent },
    @Req() req: Request,
  ) {
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    return this.authService.verifyChallenge(body.event, userAgent, ipAddress);
  }

  // ============ LNURL-auth ============

  @Get('lnurl')
  @ApiOperation({ summary: 'Generate LNURL-auth QR code data' })
  @ApiResponse({ status: 200, description: 'LNURL and k1 challenge' })
  async getLnurlAuth() {
    return this.authService.generateLnurlAuth();
  }

  @Get('lnurl-callback')
  @ApiOperation({ summary: 'LNURL-auth callback (called by wallet)' })
  @ApiQuery({ name: 'k1', required: true })
  @ApiQuery({ name: 'sig', required: true })
  @ApiQuery({ name: 'key', required: true })
  @ApiResponse({ status: 200, description: 'OK status' })
  async lnurlCallback(
    @Query('k1') k1: string,
    @Query('sig') sig: string,
    @Query('key') key: string,
  ) {
    return this.authService.handleLnurlCallback(k1, sig, key);
  }

  @Get('lnurl-poll')
  @ApiOperation({ summary: 'Poll LNURL-auth status' })
  @ApiQuery({ name: 'k1', required: true })
  @ApiResponse({ status: 200, description: 'Auth status and token if verified' })
  async pollLnurlAuth(
    @Query('k1') k1: string,
    @Req() req: Request,
  ) {
    const userAgent = req.get('user-agent');
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    return this.authService.pollLnurlAuth(k1, userAgent, ipAddress);
  }

  // ============ Session Management ============

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async getMe(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    const user = await this.authService.getOrCreateUser(pubkey);
    
    return {
      pubkey: user.pubkey,
      npub: user.npub,
      tier: user.subscription?.tier || 'FREE',
      nip05s: user.nip05s,
      wotScore: user.wotScore?.trustScore || 0,
      subscription: user.subscription ? {
        tier: user.subscription.tier,
        expiresAt: user.subscription.expiresAt,
        isActive: user.subscription.expiresAt 
          ? user.subscription.expiresAt > new Date() 
          : user.subscription.tier === 'FREE',
      } : null,
    };
  }

  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout and invalidate session' })
  @ApiResponse({ status: 204, description: 'Logged out successfully' })
  async logout(@Headers('authorization') authHeader: string) {
    if (authHeader?.startsWith('Bearer ')) {
      await this.authService.logout(authHeader.slice(7));
    }
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active sessions' })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  async getSessions(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'GET', url);
    return this.authService.getUserSessions(pubkey);
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiResponse({ status: 204, description: 'Session revoked' })
  async revokeSession(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
    @Param('sessionId') sessionId: string,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyAuth(authHeader, 'DELETE', url);
    await this.authService.revokeSession(pubkey, sessionId);
  }

  // ============ Legacy NIP-98 Auth ============

  @Post('verify-nip98')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify NIP-98 auth header (legacy)' })
  @ApiResponse({ status: 200, description: 'User profile' })
  @ApiResponse({ status: 401, description: 'Invalid authentication' })
  async verifyNip98Auth(
    @Headers('authorization') authHeader: string,
    @Req() req: Request,
  ) {
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const pubkey = await this.authService.verifyNip98Auth(authHeader, 'POST', url);
    const user = await this.authService.getOrCreateUser(pubkey);
    
    return {
      pubkey: user.pubkey,
      npub: user.npub,
      tier: user.subscription?.tier || 'FREE',
      nip05s: user.nip05s,
      wotScore: user.wotScore?.trustScore || 0,
    };
  }
}
