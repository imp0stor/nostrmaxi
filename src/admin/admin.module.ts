import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { WotModule } from '../wot/wot.module';
import { RelayDiscoveryModule } from '../relay-discovery/relay-discovery.module';
import { EcosystemCatalogModule } from '../ecosystem-catalog/ecosystem-catalog.module';
import { AuctionModule } from '../auctions/auction.module';

@Module({
  imports: [AuthModule, WotModule, RelayDiscoveryModule, EcosystemCatalogModule, AuctionModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
