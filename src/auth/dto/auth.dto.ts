import { IsOptional, IsString, IsNotEmpty, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NostrAuthEvent } from '../auth.service';

export class ChallengeRequestDto {
  @ApiPropertyOptional({ description: 'Optional pubkey to lock the challenge to a specific user' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  pubkey?: string;
}

export class VerifyChallengeDto {
  @ApiProperty({ description: 'Signed Nostr auth event payload' })
  @IsObject()
  event: NostrAuthEvent;
}
