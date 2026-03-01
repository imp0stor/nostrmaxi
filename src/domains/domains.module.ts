import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
