import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AuthModule } from '../auth/auth.module';
import { UserAnalyticsService } from './user-analytics.service';
import { NetworkAnalyticsService } from './scopes/network-analytics.service';
import { RelayAnalyticsService } from './scopes/relay-analytics.service';
import { WotAnalyticsService } from './scopes/wot-analytics.service';
import { TopicAnalyticsService } from './scopes/topic-analytics.service';
import { AnalyticsDataService } from './analytics-data.service';

@Module({
  imports: [AuthModule],
  controllers: [AnalyticsController],
  providers: [
    UserAnalyticsService,
    NetworkAnalyticsService,
    RelayAnalyticsService,
    WotAnalyticsService,
    TopicAnalyticsService,
    AnalyticsDataService,
  ],
  exports: [
    UserAnalyticsService,
    NetworkAnalyticsService,
    RelayAnalyticsService,
    WotAnalyticsService,
    TopicAnalyticsService,
    AnalyticsDataService,
  ],
})
export class AnalyticsModule {}
