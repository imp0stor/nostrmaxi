import { AuctionService } from '../auctions/auction.service';
import { parseZapReceiptToBid, NOSTR_KIND_ZAP_RECEIPT } from '../auctions/auction.events';

describe('AuctionService', () => {
  let service: AuctionService;
  const aliceHex = 'a'.repeat(64);
  const bobHex = 'b'.repeat(64);
  const carolHex = 'c'.repeat(64);

  beforeEach(() => {
    service = new AuctionService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function setNowSeconds(seconds: number) {
    jest.spyOn(Date, 'now').mockReturnValue(seconds * 1000);
  }

  it('parses bid from memo before zap amount and prefers sender P tag identity', () => {
    const parsed = parseZapReceiptToBid(
      {
        id: 'zap1',
        pubkey: aliceHex,
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000000,
        content: 'bid:50000',
        tags: [
          ['e', 'auction-event-1'],
          ['amount', '25000000'],
          ['P', bobHex],
        ],
      },
      'auction-event-1',
    );

    expect(parsed.bid?.bidAmountSats).toBe(50000);
    expect(parsed.bid?.zapAmountSats).toBe(25000);
    expect(parsed.bid?.bidderPubkey).toBe(bobHex);
  });

  it('accepts memo npub as bidder fallback when sender tag is absent', () => {
    const parsed = parseZapReceiptToBid(
      {
        id: 'zap2',
        pubkey: 'not-a-hex-pubkey',
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000001,
        content: 'bid:70000:npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
        tags: [
          ['e', 'auction-event-1'],
          ['amount', '70000000'],
        ],
      },
      'auction-event-1',
    );

    expect(parsed.bid?.bidderPubkey).toBe('npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq');
    expect(parsed.bid?.bidAmountSats).toBe(70000);
  });

  it('rejects bid when sender cannot be identified', () => {
    const parsed = parseZapReceiptToBid(
      {
        id: 'zap3',
        pubkey: 'not-a-hex-pubkey',
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000002,
        content: '70000',
        tags: [
          ['e', 'auction-event-1'],
          ['amount', '70000000'],
        ],
      },
      'auction-event-1',
    );

    expect(parsed.bid).toBeUndefined();
    expect(parsed.reason).toMatch(/unable to identify bidder/i);
  });

  it('enforces 10% minimum increment and extends by anti-sniping rule', () => {
    setNowSeconds(1700000010);

    const { auction } = service.createAuction({
      name: 'q',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 500000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const firstBid = service.ingestZapBid(auction.id, {
      id: 'zap-1',
      pubkey: aliceHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: 1700000200,
      content: '',
      tags: [
        ['e', auction.eventId],
        ['amount', String(150000 * 1000)],
        ['P', aliceHex],
      ],
    });

    expect(firstBid.bidAmountSats).toBe(150000);

    expect(() =>
      service.ingestZapBid(auction.id, {
        id: 'zap-2',
        pubkey: bobHex,
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000400,
        content: '160000',
        tags: [
          ['e', auction.eventId],
          ['amount', String(160000 * 1000)],
          ['P', bobHex],
        ],
      }),
    ).toThrow(/minimum allowed is 165000/);

    const pre = service.getAuction(auction.id).auction.endsAt;

    service.ingestZapBid(auction.id, {
      id: 'zap-3',
      pubkey: carolHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: pre - 30,
      content: '200000',
      tags: [
        ['e', auction.eventId],
        ['amount', String(200000 * 1000)],
        ['P', carolHex],
      ],
    });

    const post = service.getAuction(auction.id).auction.endsAt;
    expect(post).toBe(pre + 600);
  });

  it('settles to highest bid if reserve met', () => {
    setNowSeconds(1700000010);
    const { auction } = service.createAuction({
      name: 'zz',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 500000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    service.ingestZapBid(auction.id, {
      id: 'zap-a',
      pubkey: aliceHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: 1700000100,
      content: '550000',
      tags: [
        ['e', auction.eventId],
        ['amount', String(550000 * 1000)],
        ['P', aliceHex],
      ],
    });

    setNowSeconds(1700003000);

    const result = service.settleAuction(auction.id);
    expect(result.state).toBe('SETTLED');
    expect(result.reserveMet).toBe(true);
    expect(result.winnerPubkey).toBe(aliceHex);
    expect(result.winningBidSats).toBe(550000);
  });
});
