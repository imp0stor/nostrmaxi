import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, IsUrl, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyIdentityDto {
  @ApiPropertyOptional({ description: 'npub (preferred) or hex pubkey' })
  @IsString()
  npub!: string;

  @ApiPropertyOptional({ description: 'Minimum WoT score required', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiPropertyOptional({ description: 'Optional callback URL for this verification result' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;
}

export class BatchVerifyIdentityDto {
  @ApiProperty({ type: [VerifyIdentityDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => VerifyIdentityDto)
  identities!: VerifyIdentityDto[];
}
