import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionTier } from '../../payments/payments.service';

const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'BUSINESS', 'LIFETIME'];

export class UpgradeSubscriptionDto {
  @ApiProperty({ description: 'Subscription tier to upgrade to', enum: SUBSCRIPTION_TIERS })
  @IsIn(SUBSCRIPTION_TIERS)
  tier: SubscriptionTier;

  @ApiPropertyOptional({ description: 'Apply Web of Trust discount when available' })
  @IsOptional()
  @IsBoolean()
  applyWotDiscount?: boolean;
}
