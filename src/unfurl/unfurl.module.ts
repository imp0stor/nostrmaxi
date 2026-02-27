import { Module } from '@nestjs/common';
import { UnfurlController } from './unfurl.controller';
import { UnfurlService } from './unfurl.service';

@Module({
  controllers: [UnfurlController],
  providers: [UnfurlService],
})
export class UnfurlModule {}
