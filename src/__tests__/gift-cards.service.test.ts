import { GiftCardsService } from '../gift-cards/gift-cards.service';

describe('GiftCardsService', () => {
  const prisma: any = {
    user: { findUnique: jest.fn() },
    giftCard: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: GiftCardsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GiftCardsService(prisma);
  });

  it('applies 2% fee when funding and updates status', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      code: 'ABCD-EFGH-IJKL',
      creatorPubkey: 'pub',
      amountSats: 100000,
      remainingSats: 100000,
      fundingPaid: false,
    });
    prisma.giftCard.update.mockResolvedValue({ status: 'funded', remainingSats: 98000 });

    const result = await service.markFunded('pub', 'ABCD-EFGH-IJKL', 'payref');

    expect(prisma.giftCard.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ remainingSats: 98000, status: 'funded', fundingPaid: true }),
    }));
    expect(result.status).toBe('funded');
  });

  it('redeems partially and marks partially_redeemed', async () => {
    prisma.giftCard.findUnique.mockResolvedValue({
      code: 'ABCD-EFGH-IJKL',
      amountSats: 100000,
      remainingSats: 98000,
      status: 'funded',
      fundingPaid: true,
      expiresAt: null,
    });
    prisma.giftCard.update.mockResolvedValue({
      code: 'ABCD-EFGH-IJKL',
      remainingSats: 48000,
      status: 'partially_redeemed',
    });

    const result = await service.redeem('ABCD-EFGH-IJKL', {
      amountSats: 50000,
      lightningAddress: 'alice@getalby.com',
    });

    expect(result.status).toBe('partially_redeemed');
    expect(result.redeemedSats).toBe(50000);
    expect(result.remainingSats).toBe(48000);
  });
});
