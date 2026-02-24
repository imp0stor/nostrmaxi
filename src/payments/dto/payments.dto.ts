import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionTier } from '../payments.service';

const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'BUSINESS', 'LIFETIME'];
const BILLING_CYCLES = ['monthly', 'annual', 'lifetime'] as const;

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Subscription tier', enum: SUBSCRIPTION_TIERS })
  @IsIn(SUBSCRIPTION_TIERS)
  tier: SubscriptionTier;

  @ApiPropertyOptional({ description: 'Apply Web of Trust discount when available' })
  @IsOptional()
  @IsBoolean()
  applyWotDiscount?: boolean;

  @ApiPropertyOptional({ description: 'Billing cycle', enum: BILLING_CYCLES })
  @IsOptional()
  @IsIn(BILLING_CYCLES)
  billingCycle?: 'monthly' | 'annual' | 'lifetime';
}
