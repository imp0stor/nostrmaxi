import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

const TIER_LIMITS: Record<string, number> = {
  FREE: 0,
  PRO: 3,
  CREATOR: 3,
  BUSINESS: 10,
  STUDIO: 10,
  LIFETIME: Number.MAX_SAFE_INTEGER,
};

@Injectable()
export class BooksService {
  constructor(private readonly prisma: PrismaService) {}

  private async findOrCreateUser(pubkey: string) {
    const existing = await this.prisma.user.findUnique({ where: { pubkey }, include: { subscription: true } });
    if (existing) return existing;

    return this.prisma.user.create({
      data: {
        pubkey,
        npub: `npub_${pubkey.slice(0, 16)}_${Date.now()}`,
      },
      include: { subscription: true },
    });
  }

  private resolveBookLimit(tier?: string | null): number {
    const normalized = String(tier || 'FREE').toUpperCase();
    return TIER_LIMITS[normalized] ?? 0;
  }

  private async assertOwnership(pubkey: string, bookId: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId }, include: { chapters: { orderBy: { orderIndex: 'asc' } } } });
    if (!book) throw new NotFoundException('Book not found');
    if (book.authorPubkey !== pubkey) throw new ForbiddenException('Book not found');
    return book;
  }

  async create(pubkey: string, dto: CreateBookDto) {
    const user = await this.findOrCreateUser(pubkey);
    const limit = this.resolveBookLimit(user.subscription?.tier);
    const currentCount = await this.prisma.book.count({ where: { authorPubkey: pubkey } });

    if (currentCount >= limit) {
      throw new BadRequestException(`Book limit reached for tier ${(user.subscription?.tier || 'FREE').toUpperCase()}. Limit: ${limit}`);
    }

    return this.prisma.book.create({
      data: {
        authorPubkey: pubkey,
        title: dto.title,
        description: dto.description,
        coverUrl: dto.coverUrl,
      },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async listMine(pubkey: string) {
    return this.prisma.book.findMany({
      where: { authorPubkey: pubkey },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(pubkey: string, bookId: string) {
    return this.assertOwnership(pubkey, bookId);
  }

  async update(pubkey: string, bookId: string, dto: UpdateBookDto) {
    await this.assertOwnership(pubkey, bookId);

    return this.prisma.book.update({
      where: { id: bookId },
      data: {
        title: dto.title,
        description: dto.description,
        coverUrl: dto.coverUrl,
      },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  async remove(pubkey: string, bookId: string) {
    await this.assertOwnership(pubkey, bookId);
    await this.prisma.book.delete({ where: { id: bookId } });
    return { ok: true };
  }

  async addChapter(pubkey: string, bookId: string, dto: CreateChapterDto) {
    const book = await this.assertOwnership(pubkey, bookId);
    const orderIndex = dto.orderIndex ?? book.chapters.length;

    if (dto.orderIndex !== undefined) {
      await this.prisma.chapter.updateMany({
        where: { bookId, orderIndex: { gte: orderIndex } },
        data: { orderIndex: { increment: 1 } },
      });
    }

    return this.prisma.chapter.create({
      data: {
        bookId,
        title: dto.title,
        content: dto.content,
        orderIndex,
      },
    });
  }

  async updateChapter(pubkey: string, bookId: string, chapterId: string, dto: UpdateChapterDto) {
    await this.assertOwnership(pubkey, bookId);
    const chapter = await this.prisma.chapter.findFirst({ where: { id: chapterId, bookId } });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const nextOrderIndex = dto.orderIndex;
    if (Number.isInteger(nextOrderIndex) && nextOrderIndex !== chapter.orderIndex) {
      const chapterCount = await this.prisma.chapter.count({ where: { bookId } });
      const bounded = Math.max(0, Math.min(Number(nextOrderIndex), chapterCount - 1));
      await this.reorderChapter(bookId, chapter.id, chapter.orderIndex, bounded);
    }

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        title: dto.title,
        content: dto.content,
      },
    });
  }

  private async reorderChapter(bookId: string, chapterId: string, from: number, to: number) {
    if (from === to) return;
    if (from < to) {
      await this.prisma.chapter.updateMany({
        where: { bookId, orderIndex: { gt: from, lte: to } },
        data: { orderIndex: { decrement: 1 } },
      });
    } else {
      await this.prisma.chapter.updateMany({
        where: { bookId, orderIndex: { gte: to, lt: from } },
        data: { orderIndex: { increment: 1 } },
      });
    }
    await this.prisma.chapter.update({ where: { id: chapterId }, data: { orderIndex: to } });
  }

  async removeChapter(pubkey: string, bookId: string, chapterId: string) {
    await this.assertOwnership(pubkey, bookId);
    const chapter = await this.prisma.chapter.findFirst({ where: { id: chapterId, bookId } });
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.prisma.chapter.delete({ where: { id: chapterId } });
    await this.prisma.chapter.updateMany({
      where: { bookId, orderIndex: { gt: chapter.orderIndex } },
      data: { orderIndex: { decrement: 1 } },
    });

    return { ok: true };
  }

  async publish(pubkey: string, bookId: string) {
    const book = await this.assertOwnership(pubkey, bookId);

    if (book.chapters.length === 0) {
      throw new BadRequestException('At least one chapter is required before publishing');
    }

    const longFormContent = [
      `# ${book.title}`,
      book.description || '',
      ...book.chapters.map((chapter) => `\n## ${chapter.title}\n\n${chapter.content}`),
    ].join('\n\n');

    const nostrEventId = createHash('sha256').update(`${book.id}:${longFormContent}`).digest('hex');

    return this.prisma.book.update({
      where: { id: bookId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        nostrEventId,
      },
      include: { chapters: { orderBy: { orderIndex: 'asc' } } },
    });
  }

  private renderExport(book: any, format: 'pdf' | 'epub'): Buffer {
    const marker = format === 'pdf' ? 'PDF' : 'EPUB';
    const body = [
      `${marker} EXPORT`,
      `Title: ${book.title}`,
      `Description: ${book.description || ''}`,
      ...book.chapters.map((chapter: any) => `\n# ${chapter.title}\n${chapter.content}`),
    ].join('\n');
    return Buffer.from(body, 'utf-8');
  }

  private async storeOnBlossom(bookId: string, format: 'pdf' | 'epub', payload: Buffer): Promise<string> {
    const dir = join(process.cwd(), 'data', 'blossom', 'books');
    await mkdir(dir, { recursive: true });
    const fileName = `${bookId}-${Date.now()}.${format}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, payload);
    const baseUrl = (process.env.BLOSSOM_PUBLIC_BASE_URL || 'https://blossom.nostrmaxi.local').replace(/\/$/, '');
    return `${baseUrl}/books/${fileName}`;
  }

  async export(pubkey: string, bookId: string, format: 'pdf' | 'epub') {
    if (!['pdf', 'epub'].includes(format)) {
      throw new BadRequestException('Format must be pdf or epub');
    }

    const book = await this.assertOwnership(pubkey, bookId);
    const payload = this.renderExport(book, format);
    const downloadUrl = await this.storeOnBlossom(bookId, format, payload);

    return {
      format,
      downloadUrl,
      sizeBytes: payload.byteLength,
    };
  }

  async salesDashboard(pubkey: string, bookId: string) {
    const book = await this.assertOwnership(pubkey, bookId);
    return {
      bookId: book.id,
      totalEarningsSats: Number(book.totalZaps || 0n),
      buyerCount: book.buyerCount,
      status: book.status,
      updatedAt: book.updatedAt,
    };
  }

  async trackZap(bookId: string, amountSats: number, buyerPubkey?: string) {
    const book = await this.prisma.book.findUnique({ where: { id: bookId } });
    if (!book) throw new NotFoundException('Book not found');

    const incrementBuyer = buyerPubkey ? 1 : 0;
    return this.prisma.book.update({
      where: { id: bookId },
      data: {
        totalZaps: { increment: BigInt(Math.max(0, amountSats)) },
        buyerCount: { increment: incrementBuyer },
      },
    });
  }
}
