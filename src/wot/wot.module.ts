import { Module } from '@nestjs/common';
import { WotController } from './wot.controller';
import { WotService } from './wot.service';

@Module({
  controllers: [WotController],
  providers: [WotService],
  exports: [WotService],
})
export class WotModule {}
