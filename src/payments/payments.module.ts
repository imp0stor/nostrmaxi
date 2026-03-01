import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WotModule } from '../wot/wot.module';
import { SplitPaymentService } from './split-payment.service';

@Module({
  imports: [PrismaModule, AuthModule, WebhooksModule, WotModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SplitPaymentService],
  exports: [PaymentsService, SplitPaymentService],
})
export class PaymentsModule {}
