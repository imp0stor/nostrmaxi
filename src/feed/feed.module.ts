import { Module } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedController } from './feed.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NostrModule } from '../nostr/nostr.module';
import { WotModule } from '../wot/wot.module';

@Module({
  imports: [PrismaModule, NostrModule, WotModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService],
})
export class FeedModule {}
