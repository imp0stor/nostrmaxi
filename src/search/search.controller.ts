import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchFilteredDto } from './dto/search-filtered.dto';

@ApiTags('search')
@Controller('api/v1/search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search via Beacon (proxy + cache)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'mode', required: false, description: 'Search mode (e.g. vector, hybrid)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiQuery({ name: 'offset', required: false, description: 'Result offset' })
  @ApiQuery({ name: 'facets', required: false, description: 'Include facets (true/false)' })
  @ApiResponse({ status: 200, description: 'Beacon search results (or cached fallback)' })
  async search(@Query() query: Record<string, unknown>) {
    return this.searchService.search(query);
  }

  @Post('filtered')
  @ApiOperation({ summary: 'Filtered search via Beacon (proxy + cache)' })
  @ApiBody({ type: SearchFilteredDto })
  @ApiResponse({ status: 200, description: 'Filtered Beacon search results (or cached fallback)' })
  async searchFiltered(@Body() body: SearchFilteredDto) {
    return this.searchService.searchFiltered(body as unknown as Record<string, unknown>);
  }
}
