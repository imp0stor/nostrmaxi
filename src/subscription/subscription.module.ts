import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionsAgentController } from './subscriptions-agent.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WotModule } from '../wot/wot.module';

@Module({
  imports: [PrismaModule, AuthModule, PaymentsModule, WebhooksModule, WotModule],
  controllers: [SubscriptionController, SubscriptionsAgentController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
