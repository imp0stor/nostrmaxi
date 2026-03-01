import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';
import { FeedsService } from './feeds.service';

@ApiTags('feeds')
@Controller('api/v1/feeds')
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  @Post()
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  create(@CurrentUser() pubkey: string, @Body() dto: CreateFeedDto) {
    return this.feedsService.create(pubkey, dto);
  }

  @Get()
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  listMine(@CurrentUser() pubkey: string) {
    return this.feedsService.listMine(pubkey);
  }

  @Patch(':feedId')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  update(@CurrentUser() pubkey: string, @Param('feedId') feedId: string, @Body() dto: UpdateFeedDto) {
    return this.feedsService.update(pubkey, feedId, dto);
  }

  @Delete(':feedId')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  remove(@CurrentUser() pubkey: string, @Param('feedId') feedId: string) {
    return this.feedsService.remove(pubkey, feedId);
  }

  @Get('subscriptions/mine')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  listSubscriptions(@CurrentUser() pubkey: string) {
    return this.feedsService.listSubscriptions(pubkey);
  }

  @Post(':feedId/subscribe')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  subscribe(@CurrentUser() pubkey: string, @Param('feedId') feedId: string) {
    return this.feedsService.subscribe(pubkey, feedId);
  }

  @Delete(':feedId/subscribe')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  unsubscribe(@CurrentUser() pubkey: string, @Param('feedId') feedId: string) {
    return this.feedsService.unsubscribe(pubkey, feedId);
  }

  @Get('trending')
  trending(@Query('limit') limit = '50') {
    return this.feedsService.getTrending(Number(limit));
  }

  @Get(':feedId/rss')
  async rss(@Param('feedId') feedId: string, @Res() res: Response) {
    const xml = await this.feedsService.buildRss(feedId);
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  }
}
