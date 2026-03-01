import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';

@ApiTags('admin')
@Controller('api/v1/admin')
@UseGuards(NostrJwtAuthGuard)
export class AdminCheckController {
  private readonly bootstrapAdminPubkeys: Set<string>;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const raw = this.config.get<string>('ADMIN_PUBKEYS', '');
    this.bootstrapAdminPubkeys = new Set(
      raw
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  @Get('check')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check whether the authenticated user has admin access' })
  async check(@Req() req: { pubkey?: string }) {
    const pubkey = req.pubkey?.trim().toLowerCase();

    if (!pubkey) {
      return { isAdmin: false };
    }

    const user = await this.prisma.user.findUnique({
      where: { pubkey },
      select: { isAdmin: true },
    });

    return { isAdmin: Boolean(user?.isAdmin || this.bootstrapAdminPubkeys.has(pubkey)) };
  }
}
