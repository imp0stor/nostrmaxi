import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WotModule } from '../wot/wot.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  imports: [AuthModule, PrismaModule, WotModule, WebhooksModule],
  controllers: [IdentityController],
  providers: [IdentityService],
})
export class IdentityModule {}
