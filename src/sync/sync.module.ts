import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WotModule } from '../wot/wot.module';
import { RelayDiscoveryModule } from '../relay-discovery/relay-discovery.module';
import { NoiseFilterService } from './noise-filter.service';
import { RetentionCleanupService } from './retention-cleanup.service';
import { SyncPriorityService } from './sync-priority.service';
import { UserSyncService } from './user-sync.service';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, WotModule, RelayDiscoveryModule],
  providers: [UserSyncService, SyncPriorityService, NoiseFilterService, RetentionCleanupService],
  exports: [UserSyncService, SyncPriorityService, NoiseFilterService, RetentionCleanupService],
})
export class SyncModule {}
