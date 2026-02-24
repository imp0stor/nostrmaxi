import { Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [PrismaModule, SearchModule],
  controllers: [MetricsController],
})
export class MetricsModule {}
