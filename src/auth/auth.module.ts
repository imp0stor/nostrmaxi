import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { NostrAuthGuard } from './nostr-auth.guard';
import { PremiumGuard } from './guards/premium.guard';
import { PremiumService } from './premium.service';
import { PrismaModule } from '../prisma/prisma.module';
import { UserSyncModule } from '../sync/user-sync.module';

@Module({
  imports: [PrismaModule, UserSyncModule],
  controllers: [AuthController],
  providers: [AuthService, NostrAuthGuard, PremiumService, PremiumGuard],
  exports: [AuthService, NostrAuthGuard, PremiumService, PremiumGuard],
})
export class AuthModule {}
