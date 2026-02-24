import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { NostrAuthGuard } from '../auth/nostr-auth.guard';

@ApiTags('analytics')
@Controller('api/v1/analytics')
@UseGuards(NostrAuthGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('identity-health')
  @ApiOperation({ summary: 'Get identity health metrics' })
  @ApiResponse({ status: 200, description: 'Identity health metrics retrieved successfully' })
  async getIdentityHealth() {
    return this.analyticsService.getIdentityHealth();
  }

  @Get('growth')
  @ApiOperation({ summary: 'Get growth metrics' })
  @ApiResponse({ status: 200, description: 'Growth metrics retrieved successfully' })
  async getGrowthMetrics() {
    return this.analyticsService.getGrowthMetrics();
  }

  @Get('conversion')
  @ApiOperation({ summary: 'Get conversion metrics' })
  @ApiResponse({ status: 200, description: 'Conversion metrics retrieved successfully' })
  async getConversionMetrics() {
    return this.analyticsService.getConversionMetrics();
  }

  @Get('retention')
  @ApiOperation({ summary: 'Get retention metrics' })
  @ApiResponse({ status: 200, description: 'Retention metrics retrieved successfully' })
  async getRetentionMetrics() {
    return this.analyticsService.getRetentionMetrics();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue metrics' })
  @ApiResponse({ status: 200, description: 'Revenue metrics retrieved successfully' })
  async getRevenueMetrics() {
    return this.analyticsService.getRevenueMetrics();
  }

  @Get('tier-distribution')
  @ApiOperation({ summary: 'Get tier distribution' })
  @ApiResponse({ status: 200, description: 'Tier distribution retrieved successfully' })
  async getTierDistribution() {
    return this.analyticsService.getTierDistribution();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive analytics dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard() {
    const [identityHealth, growth, conversion, retention, revenue, tierDistribution] =
      await Promise.all([
        this.analyticsService.getIdentityHealth(),
        this.analyticsService.getGrowthMetrics(),
        this.analyticsService.getConversionMetrics(),
        this.analyticsService.getRetentionMetrics(),
        this.analyticsService.getRevenueMetrics(),
        this.analyticsService.getTierDistribution(),
      ]);

    return {
      identityHealth,
      growth,
      conversion,
      retention,
      revenue,
      tierDistribution,
      generatedAt: new Date().toISOString(),
    };
  }
}
