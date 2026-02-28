import { AuctionService } from '../auctions/auction.service';
import { Invoice, Payment, PaymentProvider } from '../payments/payment-provider.interface';

class MockPaymentProvider implements PaymentProvider {
  private counter = 0;
  private subscriber?: (payment: Payment) => void;

  async createInvoice(amount: number, memo: string, metadata: any): Promise<Invoice> {
    this.counter += 1;
    return {
      id: `inv-${this.counter}`,
      amount,
      memo,
      bolt11: `lnbc${amount}mock`,
      backend: 'btcpay',
      metadata,
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async checkInvoiceStatus(): Promise<'pending'> {
    return 'pending';
  }

  subscribeToPayments(callback: (payment: Payment) => void): void {
    this.subscriber = callback;
  }

  markPaid(invoiceId: string): void {
    this.subscriber?.({ invoiceId, status: 'paid', paidAt: new Date() });
  }
}

describe('Auction settlement second chance flow', () => {
  let service: AuctionService;
  let provider: MockPaymentProvider;

  beforeEach(() => {
    service = new AuctionService();
    provider = new MockPaymentProvider();
    service.setPaymentProvider(provider);
  });

  function setNow(seconds: number) {
    jest.spyOn(Date, 'now').mockReturnValue(seconds * 1000);
  }

  function addBid(auctionId: string, bidderPubkey: string, amount: number, createdAt: number) {
    const bidList = (service as any).bidsByAuction.get(auctionId) || [];
    bidList.push({
      id: `${bidderPubkey}-${amount}`,
      auctionEventId: 'evt-1',
      zapReceiptId: `zap-${amount}`,
      bidderPubkey,
      bidAmountSats: amount,
      zapAmountSats: amount,
      createdAt,
    });
    (service as any).bidsByAuction.set(auctionId, bidList);
  }

  it('creates winner invoice then moves to next bidder when winner times out', async () => {
    setNow(1700000010);

    const { auction } = service.createAuction({
      name: 'q',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 200000,
      startsAt: 1700000000,
      endsAt: 1700000500,
    });

    addBid(auction.id, 'a'.repeat(64), 400000, 1700000100);
    addBid(auction.id, 'b'.repeat(64), 350000, 1700000200);

    setNow(1700000700);
    const firstSettlement = await service.settleAuction(auction.id);

    expect(firstSettlement.awaitingPayment).toBe(true);
    expect(firstSettlement.winnerPubkey).toBe('a'.repeat(64));

    // winner did not pay within 48h
    setNow(1700000700 + 49 * 3600);
    const secondChance = await service.processSecondChance(auction.id);

    expect(secondChance.awaitingPayment).toBe(true);
    expect(secondChance.secondChanceOffer?.bidderPubkey).toBe('b'.repeat(64));
    expect(secondChance.secondChanceOffer?.status).toBe('pending');
  });

  it('settles auction when second chance bidder pays', async () => {
    setNow(1700100000);

    const { auction } = service.createAuction({
      name: 'qx',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 200000,
      startsAt: 1700090000,
      endsAt: 1700091000,
    });

    addBid(auction.id, 'a'.repeat(64), 500000, 1700090100);
    addBid(auction.id, 'b'.repeat(64), 420000, 1700090200);

    const firstSettlement = await service.settleAuction(auction.id);
    setNow(1700100000 + 49 * 3600);
    const secondChance = await service.processSecondChance(auction.id);

    provider.markPaid(secondChance.settlementInvoiceId!);

    const auctionDetail = service.getAuction(auction.id);
    expect(auctionDetail.auction.state).toBe('SETTLED');
    expect(auctionDetail.auction.winnerPubkey).toBe('b'.repeat(64));
    expect(firstSettlement.state).toBe('ENDED');
  });
});
