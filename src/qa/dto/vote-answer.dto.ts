import { IsIn } from 'class-validator';

export class VoteAnswerDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
