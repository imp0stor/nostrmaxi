import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateGiftCardDto {
  @IsInt()
  @Min(1000)
  @Max(10_000_000)
  amountSats!: number;

  @IsOptional()
  @IsString()
  designName?: string;

  @IsOptional()
  @IsString()
  designUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}

export class RedeemGiftCardDto {
  @IsOptional()
  @IsString()
  invoice?: string;

  @IsOptional()
  @IsString()
  lightningAddress?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountSats?: number;

  @IsOptional()
  @IsString()
  redeemerPubkey?: string;
}

export class SetGiftCardFundedDto {
  @IsString()
  @IsNotEmpty()
  paymentRef!: string;
}
