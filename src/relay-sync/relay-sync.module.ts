import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PriorityService } from './priority.service';
import { RateLimiterService } from './rate-limiter.service';
import { RelaySyncController } from './relay-sync.controller';
import { RelaySyncService } from './relay-sync.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [RelaySyncService, PriorityService, RateLimiterService],
  controllers: [RelaySyncController],
  exports: [RelaySyncService],
})
export class RelaySyncModule {}
