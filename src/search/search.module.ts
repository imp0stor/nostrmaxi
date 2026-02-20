import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BeaconClient } from './beacon.client';
import { SearchMetricsService } from './search-metrics.service';

@Module({
  imports: [ConfigModule],
  controllers: [SearchController],
  providers: [SearchService, BeaconClient, SearchMetricsService],
  exports: [SearchMetricsService],
})
export class SearchModule {}
