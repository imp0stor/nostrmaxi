import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export class CreateDomainDto {
  @ApiProperty({ example: 'mydomain.com' })
  @IsString()
  @Matches(DOMAIN_REGEX, { message: 'Invalid domain format' })
  domain!: string;

  @ApiPropertyOptional({ example: 'pay' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lightningName?: string;
}

export class UpdateDomainLightningDto {
  @ApiProperty({ example: 'pay' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{0,63}$/i, { message: 'Invalid lightning name' })
  lightningName!: string;
}

export class CreateSiteDto {
  @ApiPropertyOptional({ enum: ['personal', 'portfolio', 'blog'], default: 'personal' })
  @IsOptional()
  @IsString()
  @IsIn(['personal', 'portfolio', 'blog'])
  template?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateSiteDto {
  @ApiPropertyOptional({ enum: ['personal', 'portfolio', 'blog'] })
  @IsOptional()
  @IsString()
  @IsIn(['personal', 'portfolio', 'blog'])
  template?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
