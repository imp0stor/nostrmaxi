import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { NetworkAnalyticsSnapshotService } from './network-analytics.service';

@Controller('api/v1/analytics/network')
export class NetworkAnalyticsController {
  constructor(private readonly networkAnalytics: NetworkAnalyticsSnapshotService) {}

  @Get()
  async getLatestSnapshot() {
    const snapshot = await this.networkAnalytics.getLatestSnapshot();
    if (!snapshot) {
      return { message: 'No analytics snapshot available yet' };
    }
    return snapshot;
  }

  @Get('history')
  async getSnapshotHistory(@Query('hours') hours?: string) {
    const parsedHours = hours ? Number(hours) : 24;
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      throw new BadRequestException('hours must be a positive number');
    }
    return this.networkAnalytics.getSnapshotHistory(parsedHours);
  }

  @Get('drill-down/:metric')
  async getDrillDown(@Param('metric') metric: string, @Query('live') live?: string) {
    return this.networkAnalytics.getDrillDown(metric, live === 'true');
  }

  @Get('compute-now')
  async computeNow() {
    await this.networkAnalytics.computeAndStoreSnapshot();
    return { ok: true };
  }
}
