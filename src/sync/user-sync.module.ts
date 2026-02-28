import { Module } from '@nestjs/common';
import { UserSyncService } from './user-sync.service';

@Module({
  providers: [UserSyncService],
  exports: [UserSyncService],
})
export class UserSyncModule {}
