import { IsInt, IsObject, IsOptional, IsString, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchFilteredDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsString()
  mode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true))
  @IsBoolean()
  facets?: boolean;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;
}
