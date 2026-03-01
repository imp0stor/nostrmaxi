import { Module } from '@nestjs/common';
import { PrimitivesController } from './primitives.controller';
import { PrimitiveProfileService } from './profile.service';
import { PrimitiveWotService } from './wot.service';
import { PrimitiveKbService } from './kb.service';

@Module({
  controllers: [PrimitivesController],
  providers: [PrimitiveProfileService, PrimitiveWotService, PrimitiveKbService],
  exports: [PrimitiveProfileService, PrimitiveWotService, PrimitiveKbService],
})
export class PrimitivesModule {}
