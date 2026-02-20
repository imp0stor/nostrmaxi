import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { SearchMetricsService } from '../search/search-metrics.service';
import * as os from 'os';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
  constructor(
    private prisma: PrismaService,
    private searchMetrics: SearchMetricsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiProduces('text/plain')
  async getMetrics(@Res() res: Response) {
    try {
      const metrics: string[] = [];

      // Uptime
      metrics.push(
        '# HELP nostrmaxi_uptime_seconds Application uptime in seconds',
        '# TYPE nostrmaxi_uptime_seconds gauge',
        `nostrmaxi_uptime_seconds ${Math.floor(process.uptime())}`,
        '',
      );

      // Memory usage
      const memUsage = process.memoryUsage();
      metrics.push(
        '# HELP nostrmaxi_memory_heap_bytes Heap memory usage in bytes',
        '# TYPE nostrmaxi_memory_heap_bytes gauge',
        `nostrmaxi_memory_heap_bytes ${memUsage.heapUsed}`,
        '',
        '# HELP nostrmaxi_memory_rss_bytes RSS memory usage in bytes',
        '# TYPE nostrmaxi_memory_rss_bytes gauge',
        `nostrmaxi_memory_rss_bytes ${memUsage.rss}`,
        '',
      );

      // System memory
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      metrics.push(
        '# HELP nostrmaxi_system_memory_total_bytes Total system memory',
        '# TYPE nostrmaxi_system_memory_total_bytes gauge',
        `nostrmaxi_system_memory_total_bytes ${totalMem}`,
        '',
        '# HELP nostrmaxi_system_memory_free_bytes Free system memory',
        '# TYPE nostrmaxi_system_memory_free_bytes gauge',
        `nostrmaxi_system_memory_free_bytes ${freeMem}`,
        '',
      );

      // CPU load
      const loadAvg = os.loadavg();
      metrics.push(
        '# HELP nostrmaxi_cpu_load_average_1m CPU load average 1 minute',
        '# TYPE nostrmaxi_cpu_load_average_1m gauge',
        `nostrmaxi_cpu_load_average_1m ${loadAvg[0].toFixed(2)}`,
        '',
        '# HELP nostrmaxi_cpu_load_average_5m CPU load average 5 minutes',
        '# TYPE nostrmaxi_cpu_load_average_5m gauge',
        `nostrmaxi_cpu_load_average_5m ${loadAvg[1].toFixed(2)}`,
        '',
      );

      // Database stats
      try {
        const stats = await Promise.all([
          this.prisma.user.count(),
          this.prisma.nip05.count(),
          this.prisma.subscription.count(),
          this.prisma.apiKey.count(),
        ]);

        metrics.push(
          '# HELP nostrmaxi_users_total Total registered users',
          '# TYPE nostrmaxi_users_total gauge',
          `nostrmaxi_users_total ${stats[0]}`,
          '',
          '# HELP nostrmaxi_nip05_identifiers_total Total NIP-05 identifiers',
          '# TYPE nostrmaxi_nip05_identifiers_total gauge',
          `nostrmaxi_nip05_identifiers_total ${stats[1]}`,
          '',
          '# HELP nostrmaxi_subscriptions_total Total subscriptions',
          '# TYPE nostrmaxi_subscriptions_total gauge',
          `nostrmaxi_subscriptions_total ${stats[2]}`,
          '',
          '# HELP nostrmaxi_api_keys_total Total API keys',
          '# TYPE nostrmaxi_api_keys_total gauge',
          `nostrmaxi_api_keys_total ${stats[3]}`,
          '',
        );

        // Active subscriptions
        const activeSubscriptions = await this.prisma.subscription.count({
          where: {
            AND: [
              { expiresAt: { gt: new Date() } },
              { cancelledAt: null },
            ],
          },
        });
        metrics.push(
          '# HELP nostrmaxi_active_subscriptions_total Active subscriptions',
          '# TYPE nostrmaxi_active_subscriptions_total gauge',
          `nostrmaxi_active_subscriptions_total ${activeSubscriptions}`,
          '',
        );

        // Database connectivity
        metrics.push(
          '# HELP nostrmaxi_database_up Database connectivity (1=up, 0=down)',
          '# TYPE nostrmaxi_database_up gauge',
          'nostrmaxi_database_up 1',
          '',
        );
      } catch (error) {
        metrics.push(
          '# HELP nostrmaxi_database_up Database connectivity (1=up, 0=down)',
          '# TYPE nostrmaxi_database_up gauge',
          'nostrmaxi_database_up 0',
          '',
        );
      }

      const searchMetrics = this.searchMetrics.snapshot();
      metrics.push(
        '# HELP nostrmaxi_beacon_search_requests_total Total Beacon search requests',
        '# TYPE nostrmaxi_beacon_search_requests_total counter',
        `nostrmaxi_beacon_search_requests_total ${searchMetrics.totalRequests}`,
        '',
        '# HELP nostrmaxi_beacon_search_success_total Successful Beacon search requests',
        '# TYPE nostrmaxi_beacon_search_success_total counter',
        `nostrmaxi_beacon_search_success_total ${searchMetrics.successfulRequests}`,
        '',
        '# HELP nostrmaxi_beacon_search_failures_total Failed Beacon search requests',
        '# TYPE nostrmaxi_beacon_search_failures_total counter',
        `nostrmaxi_beacon_search_failures_total ${searchMetrics.failedRequests}`,
        '',
        '# HELP nostrmaxi_beacon_search_cache_hits_total Beacon search cache hits',
        '# TYPE nostrmaxi_beacon_search_cache_hits_total counter',
        `nostrmaxi_beacon_search_cache_hits_total ${searchMetrics.cacheHits}`,
        '',
        '# HELP nostrmaxi_beacon_search_last_latency_ms Last Beacon search latency in ms',
        '# TYPE nostrmaxi_beacon_search_last_latency_ms gauge',
        `nostrmaxi_beacon_search_last_latency_ms ${searchMetrics.lastLatencyMs}`,
        '',
        '# HELP nostrmaxi_beacon_search_last_error_timestamp Last Beacon search error timestamp (unix seconds, 0 if none)',
        '# TYPE nostrmaxi_beacon_search_last_error_timestamp gauge',
        `nostrmaxi_beacon_search_last_error_timestamp ${searchMetrics.lastErrorAt ? Math.floor(new Date(searchMetrics.lastErrorAt).getTime() / 1000) : 0}`,
        '',
      );

      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics.join('\n'));
    } catch (error) {
      res.status(500).send('# Error generating metrics');
    }
  }
}
