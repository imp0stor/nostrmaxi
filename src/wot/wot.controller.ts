import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WotService } from './wot.service';

@ApiTags('wot')
@Controller('api/v1/wot')
export class WotController {
  constructor(private wotService: WotService) {}

  @Get('score/:pubkey')
  @ApiOperation({ summary: 'Get Web of Trust score for a pubkey' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  @ApiResponse({ status: 200, description: 'WoT score details' })
  async getScore(@Param('pubkey') pubkey: string) {
    // Convert npub to hex if needed
    let hexPubkey = pubkey;
    if (pubkey.startsWith('npub1')) {
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(pubkey);
      hexPubkey = decoded.data as string;
    }
    return this.wotService.getScore(hexPubkey);
  }

  @Get('verify/:pubkey')
  @ApiOperation({ summary: 'Verify if a pubkey is trusted' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  @ApiQuery({ name: 'minScore', required: false, description: 'Minimum trust score (default: 50)' })
  @ApiResponse({ status: 200, description: 'Verification result' })
  async verify(
    @Param('pubkey') pubkey: string,
    @Query('minScore') minScore?: string,
  ) {
    let hexPubkey = pubkey;
    if (pubkey.startsWith('npub1')) {
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(pubkey);
      hexPubkey = decoded.data as string;
    }
    return this.wotService.verify(hexPubkey, minScore ? parseInt(minScore) : undefined);
  }

  @Get('network/:pubkey')
  @ApiOperation({ summary: 'Get WoT network for a pubkey' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  @ApiQuery({ name: 'depth', required: false, description: 'Network depth (default: 1)' })
  @ApiResponse({ status: 200, description: 'Network details' })
  async getNetwork(
    @Param('pubkey') pubkey: string,
    @Query('depth') depth?: string,
  ) {
    let hexPubkey = pubkey;
    if (pubkey.startsWith('npub1')) {
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(pubkey);
      hexPubkey = decoded.data as string;
    }
    return this.wotService.getNetwork(hexPubkey, depth ? parseInt(depth) : undefined);
  }

  @Post('recalculate/:pubkey')
  @ApiOperation({ summary: 'Recalculate WoT score for a pubkey' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  @ApiQuery({ name: 'useRealRelays', required: false, description: 'Use real relay queries (slower, default: false)' })
  @ApiResponse({ status: 200, description: 'Updated WoT score' })
  async recalculate(
    @Param('pubkey') pubkey: string,
    @Query('useRealRelays') useRealRelays?: string,
  ) {
    let hexPubkey = pubkey;
    if (pubkey.startsWith('npub1')) {
      const { nip19 } = await import('nostr-tools');
      const decoded = nip19.decode(pubkey);
      hexPubkey = decoded.data as string;
    }
    return this.wotService.recalculate(hexPubkey, useRealRelays === 'true');
  }

  @Post('recalculate-batch')
  @ApiOperation({ summary: 'Batch recalculate WoT scores for multiple pubkeys' })
  @ApiQuery({ name: 'pubkeys', required: true, description: 'Comma-separated hex pubkeys or npubs' })
  @ApiQuery({ name: 'useRealRelays', required: false, description: 'Use real relay queries (slower, default: false)' })
  @ApiResponse({ status: 200, description: 'Batch WoT score results' })
  async recalculateBatch(
    @Query('pubkeys') pubkeysParam: string,
    @Query('useRealRelays') useRealRelays?: string,
  ) {
    const pubkeys = pubkeysParam.split(',');
    const hexPubkeys = await Promise.all(
      pubkeys.map(async (pk) => {
        if (pk.startsWith('npub1')) {
          const { nip19 } = await import('nostr-tools');
          const decoded = nip19.decode(pk);
          return decoded.data as string;
        }
        return pk;
      }),
    );
    
    return this.wotService.recalculateBatch(hexPubkeys, useRealRelays === 'true');
  }
}
