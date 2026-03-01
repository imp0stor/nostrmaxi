import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export type FeedTier = 'wot' | 'genuine' | 'firehose';

export class CreateFeedDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentTypes?: string[];

  @IsOptional()
  @IsIn(['wot', 'genuine', 'firehose'])
  tier?: FeedTier;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  wotThreshold?: number;
}
