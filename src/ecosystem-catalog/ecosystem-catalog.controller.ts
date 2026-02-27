import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EcosystemCatalogService } from './ecosystem-catalog.service';
import { CatalogQuery } from './ecosystem-catalog.types';

@Controller('ecosystem')
export class EcosystemCatalogController {
  constructor(private readonly service: EcosystemCatalogService) {}

  @Get('catalog')
  list(@Query() query: CatalogQuery & { tags?: string }) {
    return this.service.list({
      ...query,
      minTrust: query.minTrust ? Number(query.minTrust) : undefined,
      tags: query.tags ? query.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
    });
  }

  @Get('catalog/:id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post('discover')
  discover() {
    return this.service.discover();
  }

  @Post('compare')
  compare(@Body() body: { ids: string[] }) {
    return this.service.compare(body.ids || []);
  }

  @Post('recommend')
  recommend(@Body() body: { category?: string; requiredNips?: string[]; pricing?: string; tags?: string[] }) {
    return this.service.recommend(body || {});
  }

  @Get('collections')
  getCollections() {
    return this.service.getCollections();
  }

  @Post('collections/:name')
  saveCollection(@Param('name') name: string, @Body() body: { ids: string[] }) {
    return this.service.saveCollection(name, body.ids || []);
  }
}
