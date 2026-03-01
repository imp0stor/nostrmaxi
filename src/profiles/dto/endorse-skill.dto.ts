import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EndorseSkillDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  skill!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
