import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PrimitiveWotService } from './wot.service';
import { PrimitiveKbService } from './kb.service';
import { PrimitiveProfileService } from './profile.service';

@ApiTags('primitives')
@Controller('api/v1/primitives')
export class PrimitivesController {
  constructor(
    private readonly wotService: PrimitiveWotService,
    private readonly kbService: PrimitiveKbService,
    private readonly profileService: PrimitiveProfileService,
  ) {}

  @Get('wot/score/:pubkey')
  @ApiOperation({ summary: 'Get primitive-based WoT score with rationale' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  @ApiQuery({ name: 'anchor', required: false, description: 'Anchor pubkey/npub to compute distance from' })
  async getWotScore(@Param('pubkey') pubkey: string, @Query('anchor') anchor?: string) {
    return this.wotService.getScore(pubkey, anchor);
  }

  @Get('kb')
  @ApiOperation({ summary: 'List KB long-form items (kind 30023)' })
  @ApiQuery({ name: 'limit', required: false })
  async listKb(@Query('limit') limit?: string) {
    return this.kbService.list(limit ? Number(limit) : 20);
  }

  @Get('kb/search')
  @ApiOperation({ summary: 'Search KB long-form items by text query' })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'limit', required: false })
  async searchKb(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.kbService.search(q, limit ? Number(limit) : 20);
  }

  @Get('profile/:pubkey/validation-hints')
  @ApiOperation({ summary: 'Profile validation hints from profile primitive parsing' })
  @ApiParam({ name: 'pubkey', description: 'Hex pubkey or npub' })
  async profileHints(@Param('pubkey') pubkey: string) {
    return this.profileService.getValidationHints(pubkey);
  }
}
