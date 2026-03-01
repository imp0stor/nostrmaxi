import { Module } from '@nestjs/common';
import { Nip05MarketplaceController } from './nip05-marketplace.controller';
import { Nip05MarketplaceService } from './nip05-marketplace.service';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuctionJobsService } from './auction-jobs.service';

@Module({
  imports: [PaymentsModule, NotificationsModule],
  controllers: [Nip05MarketplaceController],
  providers: [Nip05MarketplaceService, AuctionJobsService],
  exports: [Nip05MarketplaceService],
})
export class Nip05MarketplaceModule {}
