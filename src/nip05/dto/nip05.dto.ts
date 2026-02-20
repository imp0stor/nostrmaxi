import { IsString, IsNotEmpty, IsOptional, Matches, Length, IsLowercase } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProvisionNip05Dto {
  @ApiProperty({ 
    description: 'Local part of NIP-05 (before @)',
    example: 'alice',
    minLength: 1,
    maxLength: 64
  })
  @IsString()
  @IsNotEmpty()
  @IsLowercase()
  @Length(1, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]*[a-z0-9]$|^[a-z0-9]$/, {
    message: 'Local part must start/end with alphanumeric and can contain . _ -'
  })
  localPart: string;

  @ApiPropertyOptional({ 
    description: 'Custom domain (if verified)',
    example: 'mydomain.com'
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}$/, {
    message: 'Invalid domain format'
  })
  domain?: string;
}

export class DeleteNip05Dto {
  @ApiProperty({ description: 'Local part of NIP-05 to delete' })
  @IsString()
  @IsNotEmpty()
  localPart: string;

  @ApiPropertyOptional({ description: 'Domain (if custom)' })
  @IsOptional()
  @IsString()
  domain?: string;
}

export class LookupQueryDto {
  @ApiProperty({ description: 'Local part to lookup' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  name: string;
}

export class VerifyDomainDto {
  @ApiProperty({ description: 'Domain to verify' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}$/, {
    message: 'Invalid domain format'
  })
  domain: string;
}
