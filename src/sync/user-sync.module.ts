import { Module } from '@nestjs/common';
import { UserSyncService } from './user-sync.service';
import { RelayDiscoveryModule } from '../relay-discovery/relay-discovery.module';

@Module({
  imports: [RelayDiscoveryModule],
  providers: [UserSyncService],
  exports: [UserSyncService],
})
export class UserSyncModule {}
