import { BadRequestException } from '@nestjs/common';
import { BooksService } from '../books/books.service';

describe('BooksService', () => {
  it('enforces FREE tier 0 book limit', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', pubkey: 'pk', subscription: { tier: 'FREE' } }),
      },
      book: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const service = new BooksService(prisma);

    await expect(service.create('pk', { title: 'My Book' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('publishes book with deterministic nostrEventId', async () => {
    const prisma: any = {
      book: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'book-1',
          authorPubkey: 'pk',
          title: 'Title',
          description: 'Desc',
          chapters: [{ title: 'C1', content: 'Body', orderIndex: 0 }],
        }),
        update: jest.fn().mockResolvedValue({ status: 'published', nostrEventId: 'abc' }),
      },
    };

    const service = new BooksService(prisma);
    await service.publish('pk', 'book-1');

    expect(prisma.book.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'book-1' },
      data: expect.objectContaining({ status: 'published' }),
    }));
  });
});
