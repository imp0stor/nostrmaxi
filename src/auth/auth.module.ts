import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { NostrAuthGuard } from './nostr-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, NostrAuthGuard],
  exports: [AuthService, NostrAuthGuard],
})
export class AuthModule {}
