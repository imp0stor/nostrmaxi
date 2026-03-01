import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { NostrJwtAuthGuard } from '../auth/nostr-jwt-auth.guard';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { VoteAnswerDto } from './dto/vote-answer.dto';
import { QaService } from './qa.service';

@ApiTags('qa')
@Controller('api/v1/qa')
export class QaController {
  constructor(private readonly qaService: QaService) {}

  @Post('questions')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  createQuestion(@CurrentUser() pubkey: string, @Body() dto: CreateQuestionDto) {
    return this.qaService.createQuestion(pubkey, dto);
  }

  @Get('questions')
  listQuestions(
    @Query('tag') tag?: string,
    @Query('sort') sort: 'recent' | 'votes' | 'bounty' = 'recent',
  ) {
    return this.qaService.listQuestions(tag, sort);
  }

  @Get('questions/:id')
  getQuestion(@Param('id') id: string) {
    return this.qaService.getQuestion(id);
  }

  @Post('questions/:id/answers')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  createAnswer(@CurrentUser() pubkey: string, @Param('id') id: string, @Body() dto: CreateAnswerDto) {
    return this.qaService.createAnswer(pubkey, id, dto);
  }

  @Post('answers/:id/vote')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  voteAnswer(@CurrentUser() pubkey: string, @Param('id') id: string, @Body() dto: VoteAnswerDto) {
    return this.qaService.voteAnswer(pubkey, id, dto);
  }

  @Post('questions/:id/accept/:answerId')
  @UseGuards(NostrJwtAuthGuard)
  @ApiBearerAuth()
  acceptAnswer(@CurrentUser() pubkey: string, @Param('id') id: string, @Param('answerId') answerId: string) {
    return this.qaService.acceptAnswer(id, answerId, pubkey);
  }

  @Get('tags')
  getTags() {
    return this.qaService.listTags();
  }

  @Get('reputation/:pubkey')
  getReputation(@Param('pubkey') pubkey: string) {
    return this.qaService.getReputation(pubkey);
  }
}
