import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeedService, FeedConfig, FeedItem } from './feed.service';
import { NostrAuthGuard } from '../auth/nostr-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('Feed')
@Controller('api/v1/feed')
export class FeedController {
  constructor(private feed: FeedService) {}

  @Get()
  @UseGuards(NostrAuthGuard)
  @ApiOperation({ summary: 'Get personalized feed' })
  async getFeed(
    @CurrentUser() pubkey: string,
    @Query('content_types') contentTypes?: string,
    @Query('filter') filterMode?: 'wot' | 'genuine' | 'firehose',
    @Query('wot_depth') wotDepth?: string,
    @Query('sort') sortBy?: 'newest' | 'oldest' | 'popular' | 'trending',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ items: FeedItem[]; total: number }> {
    const items = await this.feed.generateFeed(pubkey, {
      pubkey,
      contentTypes: contentTypes ? contentTypes.split(',') : undefined,
      filterMode,
      wotDepth: wotDepth ? parseInt(wotDepth) : undefined,
      sortBy,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    return {
      items,
      total: items.length, // TODO: Return actual total count
    };
  }

  @Post('saved')
  @UseGuards(NostrAuthGuard)
  @ApiOperation({ summary: 'Save feed configuration' })
  async saveFeedConfig(
    @CurrentUser() pubkey: string,
    @Body() config: Partial<FeedConfig>,
  ): Promise<{ success: boolean }> {
    await this.feed.saveFeedConfig(pubkey, config);
    return { success: true };
  }

  @Get('saved')
  @UseGuards(NostrAuthGuard)
  @ApiOperation({ summary: 'Get saved feed configurations' })
  async getSavedFeeds(@CurrentUser() pubkey: string): Promise<FeedConfig[]> {
    return this.feed.getSavedFeeds(pubkey);
  }
}
