import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';

@ApiTags('admin')
@Controller('api/v1/admin')
@UseGuards(NostrJwtAuthGuard)
export class AdminCheckController {
  constructor(private readonly config: ConfigService) {}

  @Get('check')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check whether the authenticated user has admin access' })
  check(@Req() req: { pubkey?: string }) {
    const pubkey = req.pubkey?.trim().toLowerCase();
    const adminPubkeys = (this.config.get<string>('ADMIN_PUBKEYS', '') || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    return { isAdmin: Boolean(pubkey && adminPubkeys.includes(pubkey)) };
  }
}
