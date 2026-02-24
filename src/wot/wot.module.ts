import { Module } from '@nestjs/common';
import { WotController } from './wot.controller';
import { WotService } from './wot.service';
import { RelayWotService } from './relay-wot.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WotController],
  providers: [WotService, RelayWotService],
  exports: [WotService, RelayWotService],
})
export class WotModule {}
