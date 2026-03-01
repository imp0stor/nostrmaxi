import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { Nip05Module } from './nip05/nip05.module';
import { WotModule } from './wot/wot.module';
import { AuthModule } from './auth/auth.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AdminModule } from './admin/admin.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { IdentityModule } from './identity/identity.module';
import { UnfurlModule } from './unfurl/unfurl.module';
import { RelayMetricsModule } from './relay-metrics/relay-metrics.module';
import { EcosystemCatalogModule } from './ecosystem-catalog/ecosystem-catalog.module';
import { RelaySyncModule } from './relay-sync/relay-sync.module';
import { AuctionModule } from './auctions/auction.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { MediaDiscoveryModule } from './discovery/media-discovery.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SecurityMiddleware, RequestLoggingMiddleware } from './common/middleware/security.middleware';
import { SyncModule } from './sync/sync.module';
import { RelayAggregatorModule } from './relay-aggregator/relay-aggregator.module';
import { RelayDiscoveryModule } from './relay-discovery/relay-discovery.module';
import { AppConfigModule } from './config/config.module';
import { PrimitivesModule } from './primitives/primitives.module';
import { Nip05MarketplaceModule } from './nip05-marketplace/nip05-marketplace.module';
import { FeedsModule } from './feeds/feeds.module';
import { DomainsModule } from './domains/domains.module';
import { QaModule } from './qa/qa.module';
import { BooksModule } from './books/books.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          ttl: 60000,  // Default TTL in ms
        }),
      }),
    }),
    PrismaModule,
    ScheduleModule.forRoot(),
    AppConfigModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    Nip05MarketplaceModule,  // Must be before Nip05Module to avoid :address wildcard matching
    Nip05Module,
    WotModule,
    PaymentsModule,
    SubscriptionModule,
    ApiKeysModule,
    AdminModule,
    SearchModule,
    SettingsModule,
    IdentityModule,
    UnfurlModule,
    RelayMetricsModule,
    EcosystemCatalogModule,
    RelaySyncModule,
    SyncModule,
    RelayAggregatorModule,
    RelayDiscoveryModule,
    AuctionModule,
    OnboardingModule,
    MediaDiscoveryModule,
    AnalyticsModule,
    NotificationsModule,
    PrimitivesModule,
    FeedsModule,
    DomainsModule,
    QaModule,
    BooksModule,
    GiftCardsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
