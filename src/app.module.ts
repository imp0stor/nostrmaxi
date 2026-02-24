import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { AnalyticsModule } from './analytics/analytics.module';
import { CommerceModule } from './commerce/commerce.module';
import { NostrModule } from './nostr/nostr.module';
import { FeedModule } from './feed/feed.module';
import { ContentModule } from './content/content.module';
import { SecurityMiddleware, RequestLoggingMiddleware } from './common/middleware/security.middleware';

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
    EventEmitterModule.forRoot(),
    PrismaModule,
    NostrModule,
    HealthModule,
    MetricsModule,
    AuthModule,
    Nip05Module,
    WotModule,
    PaymentsModule,
    SubscriptionModule,
    ApiKeysModule,
    AdminModule,
    SearchModule,
    AnalyticsModule,
    CommerceModule,
    FeedModule,
    ContentModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware, RequestLoggingMiddleware)
      .forRoutes('*');
  }
}
