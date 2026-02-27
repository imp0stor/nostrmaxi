import { Module } from '@nestjs/common';
import { Nip05Controller } from './nip05.controller';
import { Nip05Service } from './nip05.service';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [Nip05Controller],
  providers: [Nip05Service],
  exports: [Nip05Service],
})
export class Nip05Module {}
