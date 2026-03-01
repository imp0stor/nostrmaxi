import { IsString, MinLength } from 'class-validator';

export class CreateAnswerDto {
  @IsString()
  @MinLength(5)
  body!: string;
}
