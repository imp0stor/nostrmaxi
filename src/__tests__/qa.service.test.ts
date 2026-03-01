import { QaService } from '../qa/qa.service';

describe('QaService voting', () => {
  it('changes vote direction and returns updated answer', async () => {
    const answer = { id: 'a1', authorPubkey: 'author', questionId: 'q1' } as any;
    const tx = {
      vote: { update: jest.fn() },
      answer: { update: jest.fn() },
      reputation: {
        findUnique: jest.fn().mockResolvedValue({ pubkey: 'author', score: 50 }),
        update: jest.fn(),
      },
    };

    const prisma = {
      answer: {
        findUnique: jest.fn().mockResolvedValueOnce(answer).mockResolvedValueOnce({ ...answer, upvotes: 0, downvotes: 1 }),
      },
      vote: {
        findUnique: jest.fn().mockResolvedValue({ id: 'v1', direction: 'up' }),
      },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    } as any;

    const service = new QaService(prisma);
    const result = await service.voteAnswer('voter', 'a1', { direction: 'down' });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.vote.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { direction: 'down' } });
    expect(result).toMatchObject({ id: 'a1' });
  });
});
