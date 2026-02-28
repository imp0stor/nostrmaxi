import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WotModule } from '../wot/wot.module';
import { RelayController } from './relay.controller';
import { RelayDiscoveryService } from './relay-discovery.service';
import { WotRelayService } from './wot-relay.service';

@Module({
  imports: [ConfigModule, WotModule],
  providers: [RelayDiscoveryService, WotRelayService],
  controllers: [RelayController],
  exports: [RelayDiscoveryService, WotRelayService],
})
export class RelayDiscoveryModule {}
