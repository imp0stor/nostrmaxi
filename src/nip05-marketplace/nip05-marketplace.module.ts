import { Module } from '@nestjs/common';
import { Nip05MarketplaceController } from './nip05-marketplace.controller';
import { Nip05MarketplaceService } from './nip05-marketplace.service';

@Module({
  controllers: [Nip05MarketplaceController],
  providers: [Nip05MarketplaceService],
  exports: [Nip05MarketplaceService],
})
export class Nip05MarketplaceModule {}
