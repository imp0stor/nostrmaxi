import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NostrService } from './nostr.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [NostrService],
  exports: [NostrService],
})
export class NostrModule {}
