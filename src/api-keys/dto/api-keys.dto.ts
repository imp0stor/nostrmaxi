import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsISO8601, ArrayUnique } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const API_KEY_PERMISSIONS = ['read', 'write', 'admin'] as const;

export class CreateApiKeyDto {
  @ApiProperty({ description: 'API key label' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Permissions for this API key', enum: API_KEY_PERMISSIONS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(API_KEY_PERMISSIONS, { each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Expiration timestamp (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
