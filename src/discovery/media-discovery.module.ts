import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaDiscoveryController } from './media-discovery.controller';
import { MediaDiscoveryService } from './media-discovery.service';
import { PodcastIndexClient } from './podcast-index.client';

@Module({
  imports: [ConfigModule],
  controllers: [MediaDiscoveryController],
  providers: [MediaDiscoveryService, PodcastIndexClient],
  exports: [MediaDiscoveryService],
})
export class MediaDiscoveryModule {}
