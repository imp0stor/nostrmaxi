import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WotModule } from '../wot/wot.module';

@Module({
  imports: [PrismaModule, WotModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
