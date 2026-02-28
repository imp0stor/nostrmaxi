import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UnfurlService } from './unfurl.service';

@ApiTags('unfurl')
@Controller('api/v1/unfurl')
export class UnfurlController {
  constructor(private readonly unfurlService: UnfurlService) {}

  @Get()
  @ApiOperation({ summary: 'Fetch link preview metadata (OpenGraph + fallback tags)' })
  @ApiQuery({ name: 'url', required: true, description: 'The URL to unfurl' })
  async getPreview(@Query('url') url?: string) {
    if (!url) {
      throw new BadRequestException('url query parameter is required');
    }

    try {
      return await this.unfurlService.unfurl(url);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Failed to fetch metadata');
    }
  }
}
