import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RelaySyncService } from './relay-sync.service';
import { RelaySyncController } from './relay-sync.controller';

@Module({
  imports: [ConfigModule],
  providers: [RelaySyncService],
  controllers: [RelaySyncController],
  exports: [RelaySyncService],
})
export class RelaySyncModule {}
