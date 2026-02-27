import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RelayMetricsService } from './relay-metrics.service';

@ApiTags('relays')
@Controller('api/v1/relays')
export class RelayMetricsController {
  constructor(private readonly relayMetricsService: RelayMetricsService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Relay metrics and ranking data (cached)' })
  @ApiResponse({ status: 200, description: 'Relay metrics snapshot' })
  async getRelayMetrics() {
    return this.relayMetricsService.getRelayMetrics();
  }
}
