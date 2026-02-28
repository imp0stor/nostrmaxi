import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { AuctionModule } from '../auctions/auction.module';

@Module({
  imports: [AuctionModule],
  controllers: [PaymentController],
})
export class PaymentModule {}
