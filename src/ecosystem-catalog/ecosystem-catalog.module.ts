import { Module } from '@nestjs/common';
import { EcosystemCatalogController } from './ecosystem-catalog.controller';
import { EcosystemCatalogService } from './ecosystem-catalog.service';

@Module({
  controllers: [EcosystemCatalogController],
  providers: [EcosystemCatalogService],
})
export class EcosystemCatalogModule {}
