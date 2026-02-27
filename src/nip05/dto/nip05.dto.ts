import { IsString, IsNotEmpty, IsOptional, Matches, Length, IsLowercase, IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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

export class RegisterNip05Dto {
  @ApiProperty({ description: 'NIP-05 address to register', example: 'alice@nostrmaxi.com' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Target npub (or pubkey) for assignment' })
  @IsString()
  @IsNotEmpty()
  npub: string;

  @ApiPropertyOptional({ description: 'Optional callback URL for async notification' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;
}

export class BatchRegisterNip05Dto {
  @ApiProperty({ type: [RegisterNip05Dto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RegisterNip05Dto)
  registrations!: RegisterNip05Dto[];
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
