import { Module } from '@nestjs/common';
import { PrimitivesController } from './primitives.controller';
import { PrimitiveProfileService } from './profile.service';
import { PrimitiveWotService } from './wot.service';
import { PrimitiveKbService } from './kb.service';
import { PrimitiveEngagementService } from './engagement.service';

@Module({
  controllers: [PrimitivesController],
  providers: [PrimitiveProfileService, PrimitiveWotService, PrimitiveKbService, PrimitiveEngagementService],
  exports: [PrimitiveProfileService, PrimitiveWotService, PrimitiveKbService, PrimitiveEngagementService],
})
export class PrimitivesModule {}
