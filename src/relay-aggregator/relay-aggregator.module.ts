import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WotModule } from '../wot/wot.module';
import { SyncModule } from '../sync/sync.module';
import { AggregatorService } from './aggregator.service';
import { IngestionService } from './ingestion.service';
import { TrendingService } from './trending.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, WotModule, SyncModule],
  providers: [AggregatorService, IngestionService, TrendingService],
  exports: [AggregatorService],
})
export class RelayAggregatorModule {}
