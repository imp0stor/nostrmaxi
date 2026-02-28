import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MediaDiscoveryService, type CreatorType } from './media-discovery.service';

@ApiTags('media-discovery')
@Controller('api/v1/media-discovery')
export class MediaDiscoveryController {
  constructor(private readonly mediaDiscoveryService: MediaDiscoveryService) {}

  @Get('creators')
  @ApiOperation({ summary: 'Discover Nostr and external media creators' })
  @ApiQuery({ name: 'type', required: false, enum: ['podcast', 'video', 'article', 'music', 'all'] })
  @ApiQuery({ name: 'tags', required: false, description: 'Comma-separated tags' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max creators to return' })
  @ApiResponse({ status: 200, description: 'Discovered content creators' })
  async discoverCreators(@Query('type') type?: CreatorType, @Query('tags') tags?: string, @Query('limit') limit?: string) {
    const parsedTags = (tags || '').split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const parsedLimit = Number(limit || 30);
    return this.mediaDiscoveryService.discoverCreators({
      type: type || 'all',
      tags: parsedTags,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 30,
    });
  }

  @Get('creator/:pubkey')
  @ApiOperation({ summary: 'Analyze one profile for media creator signals' })
  async analyzeProfile(@Param('pubkey') pubkey: string) {
    return this.mediaDiscoveryService.analyzeProfile(pubkey);
  }

  @Get('podcast-index')
  @ApiOperation({ summary: 'Search Podcast Index' })
  @ApiQuery({ name: 'q', required: true })
  async searchPodcastIndex(@Query('q') q: string) {
    return this.mediaDiscoveryService.searchPodcastIndex(q || 'bitcoin');
  }

  @Get('podcasts/nostr')
  @ApiOperation({ summary: 'Get Nostr-linked podcasts' })
  async getNostrPodcasts(@Query('limit') limit?: string) {
    const parsedLimit = Number(limit || 30);
    return this.mediaDiscoveryService.getNostrPodcasts(Number.isFinite(parsedLimit) ? parsedLimit : 30);
  }
}
