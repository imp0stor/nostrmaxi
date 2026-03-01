import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(180)
  title!: string;

  @IsString()
  @MinLength(20)
  body!: string;

  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  bountySats?: number;
}
