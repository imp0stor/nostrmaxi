import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCheckController } from './admin-check.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { AuthModule } from '../auth/auth.module';
import { WotModule } from '../wot/wot.module';
import { RelayDiscoveryModule } from '../relay-discovery/relay-discovery.module';
import { EcosystemCatalogModule } from '../ecosystem-catalog/ecosystem-catalog.module';
import { AuctionModule } from '../auctions/auction.module';

@Module({
  imports: [AuthModule, WotModule, RelayDiscoveryModule, EcosystemCatalogModule, AuctionModule],
  controllers: [AdminController, AdminCheckController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
