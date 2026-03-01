import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { VoteAnswerDto } from './dto/vote-answer.dto';

const PLATFORM_FEE_BPS = 500;

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTags(tags: string[]): string[] {
    const cleaned = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(cleaned)).slice(0, 8);
  }

  private msatsFromSats(sats: number): number {
    return Math.max(0, Math.floor(sats)) * 1000;
  }

  async createQuestion(authorPubkey: string, dto: CreateQuestionDto) {
    const tags = this.normalizeTags(dto.tags ?? []);
    if (!tags.length) {
      throw new BadRequestException('At least one tag is required');
    }

    return this.prisma.question.create({
      data: {
        authorPubkey,
        title: dto.title.trim(),
        body: dto.body.trim(),
        tags,
        bountyMsats: this.msatsFromSats(dto.bountySats ?? 0),
      },
    });
  }

  async listQuestions(tag?: string, sort: 'recent' | 'votes' | 'bounty' = 'recent') {
    const tagFilter = tag?.trim().toLowerCase();
    const questions = await this.prisma.question.findMany({
      where: tagFilter ? { tags: { has: tagFilter } } : undefined,
      include: {
        answers: {
          select: { id: true, upvotes: true, downvotes: true },
        },
      },
      orderBy: sort === 'bounty'
        ? { bountyMsats: 'desc' }
        : { createdAt: 'desc' },
      take: 100,
    });

    const mapped = questions.map((q) => ({
      ...q,
      voteCount: q.answers.reduce((acc, answer) => acc + (answer.upvotes - answer.downvotes), 0),
      answerCount: q.answers.length,
    }));

    if (sort === 'votes') {
      mapped.sort((a, b) => b.voteCount - a.voteCount || Number(b.createdAt) - Number(a.createdAt));
    }

    return mapped;
  }

  async getQuestion(questionId: string) {
    await this.prisma.question.update({ where: { id: questionId }, data: { viewCount: { increment: 1 } } });

    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        answers: {
          orderBy: [{ isAccepted: 'desc' }, { upvotes: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!question) throw new NotFoundException('Question not found');
    return question;
  }

  async createAnswer(authorPubkey: string, questionId: string, dto: CreateAnswerDto) {
    await this.ensureQuestionExists(questionId);

    return this.prisma.answer.create({
      data: {
        questionId,
        authorPubkey,
        body: dto.body.trim(),
      },
    });
  }

  async voteAnswer(voterPubkey: string, answerId: string, dto: VoteAnswerDto) {
    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer) throw new NotFoundException('Answer not found');

    const existing = await this.prisma.vote.findUnique({
      where: { answerId_voterPubkey: { answerId, voterPubkey } },
    });

    if (existing?.direction === dto.direction) {
      return answer;
    }

    await this.prisma.$transaction(async (tx) => {
      if (!existing) {
        await tx.vote.create({ data: { answerId, voterPubkey, direction: dto.direction } });
        await this.applyDirectionEffects(tx, answer.id, answer.authorPubkey, dto.direction, 1);
        return;
      }

      await tx.vote.update({ where: { id: existing.id }, data: { direction: dto.direction } });
      await this.applyDirectionEffects(tx, answer.id, answer.authorPubkey, existing.direction as 'up' | 'down', -1);
      await this.applyDirectionEffects(tx, answer.id, answer.authorPubkey, dto.direction, 1);
    });

    return this.prisma.answer.findUnique({ where: { id: answerId } });
  }

  async acceptAnswer(questionId: string, answerId: string, actorPubkey: string) {
    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    if (question.authorPubkey !== actorPubkey) {
      throw new BadRequestException('Only the question author can accept an answer');
    }

    const answer = await this.prisma.answer.findUnique({ where: { id: answerId } });
    if (!answer || answer.questionId !== questionId) {
      throw new NotFoundException('Answer not found for this question');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.answer.updateMany({ where: { questionId }, data: { isAccepted: false } });
      const accepted = await tx.answer.update({ where: { id: answerId }, data: { isAccepted: true } });
      await tx.question.update({ where: { id: questionId }, data: { acceptedAnswerId: answerId } });

      if (question.bountyMsats > 0 && !question.bountyPaid) {
        const payoutMsats = this.afterFee(question.bountyMsats);
        await tx.question.update({ where: { id: questionId }, data: { bountyPaid: true } });
        await tx.qaBountyPayout.create({
          data: {
            questionId,
            answerId,
            recipientPubkey: answer.authorPubkey,
            amountMsats: payoutMsats,
            feeMsats: question.bountyMsats - payoutMsats,
            mode: 'accepted',
          },
        });
      }

      return accepted;
    });
  }

  async listTags() {
    const predefined = ['nostr', 'clients', 'relays', 'protocol', 'lightning', 'development', 'identity', 'security'];
    const questions = await this.prisma.question.findMany({ select: { tags: true } });
    const counts = new Map<string, number>();

    for (const t of predefined) counts.set(t, counts.get(t) ?? 0);

    for (const q of questions) {
      for (const t of q.tags) {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([tag, questionCount]) => ({ tag, questionCount }))
      .sort((a, b) => b.questionCount - a.questionCount || a.tag.localeCompare(b.tag));
  }

  async getReputation(pubkey: string) {
    const rep = await this.prisma.reputation.findUnique({ where: { pubkey } });
    return {
      pubkey,
      score: rep?.score ?? 0,
      canEditOthers: (rep?.score ?? 0) >= 1000,
    };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async settleExpiredBounties() {
    const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const expired = await this.prisma.question.findMany({
      where: {
        bountyMsats: { gt: 0 },
        bountyPaid: false,
        acceptedAnswerId: null,
        createdAt: { lt: threshold },
      },
      include: {
        answers: {
          orderBy: [{ upvotes: 'desc' }, { downvotes: 'asc' }, { createdAt: 'asc' }],
        },
      },
      take: 200,
    });

    for (const question of expired) {
      const best = question.answers[0];
      if (!best) continue;

      await this.prisma.$transaction(async (tx) => {
        const fresh = await tx.question.findUnique({ where: { id: question.id } });
        if (!fresh || fresh.bountyPaid || fresh.acceptedAnswerId) return;

        const payoutBeforeFee = Math.floor(fresh.bountyMsats * 0.5);
        const payoutMsats = this.afterFee(payoutBeforeFee);

        await tx.question.update({ where: { id: question.id }, data: { bountyPaid: true } });
        await tx.qaBountyPayout.create({
          data: {
            questionId: question.id,
            answerId: best.id,
            recipientPubkey: best.authorPubkey,
            amountMsats: payoutMsats,
            feeMsats: fresh.bountyMsats - payoutMsats,
            mode: 'expired',
          },
        });
      });
    }
  }

  private afterFee(amountMsats: number): number {
    return Math.floor(amountMsats * (10_000 - PLATFORM_FEE_BPS) / 10_000);
  }

  private async applyDirectionEffects(tx: any, answerId: string, answererPubkey: string, direction: 'up' | 'down', multiplier: 1 | -1) {
    const repDelta = direction === 'up' ? 10 * multiplier : -2 * multiplier;
    await tx.answer.update({
      where: { id: answerId },
      data: direction === 'up' ? { upvotes: { increment: multiplier } } : { downvotes: { increment: multiplier } },
    });

    const current = await tx.reputation.findUnique({ where: { pubkey: answererPubkey } });
    if (!current) {
      await tx.reputation.create({ data: { pubkey: answererPubkey, score: Math.max(0, repDelta) } });
      return;
    }

    await tx.reputation.update({
      where: { pubkey: answererPubkey },
      data: { score: Math.max(0, current.score + repDelta) },
    });
  }

  private async ensureQuestionExists(questionId: string) {
    const exists = await this.prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Question not found');
  }
}
