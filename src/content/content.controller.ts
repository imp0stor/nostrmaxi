import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ContentService, Show, Episode } from './content.service';

@ApiTags('Content')
@Controller('api/v1/content')
export class ContentController {
  constructor(private content: ContentService) {}

  @Get('shows')
  @ApiOperation({ summary: 'List shows' })
  async listShows(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ shows: Show[]; total: number }> {
    return this.content.listShows(
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('shows/:id')
  @ApiOperation({ summary: 'Get show by ID' })
  async getShow(@Param('id') id: string): Promise<Show> {
    return this.content.getShow(id);
  }

  @Get('shows/:id/episodes')
  @ApiOperation({ summary: 'Get episodes for a show' })
  async getShowEpisodes(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ episodes: Episode[]; total: number }> {
    return this.content.getShowEpisodes(
      id,
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('episodes')
  @ApiOperation({ summary: 'List episodes' })
  async listEpisodes(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<{ episodes: Episode[]; total: number }> {
    return this.content.listEpisodes(
      limit ? parseInt(limit) : 20,
      offset ? parseInt(offset) : 0,
    );
  }

  @Get('episodes/:id')
  @ApiOperation({ summary: 'Get episode by ID' })
  async getEpisode(@Param('id') id: string): Promise<Episode> {
    return this.content.getEpisode(id);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search content' })
  async searchContent(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ): Promise<any[]> {
    if (!query) {
      return [];
    }
    return this.content.searchNotes(query, limit ? parseInt(limit) : 20);
  }
}
