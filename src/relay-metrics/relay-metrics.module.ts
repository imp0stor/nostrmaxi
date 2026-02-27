import { Module } from '@nestjs/common';
import { RelayMetricsController } from './relay-metrics.controller';
import { RelayMetricsService } from './relay-metrics.service';

@Module({
  controllers: [RelayMetricsController],
  providers: [RelayMetricsService],
  exports: [RelayMetricsService],
})
export class RelayMetricsModule {}
