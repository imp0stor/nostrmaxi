import { bech32 } from 'bech32';
import { createHash, randomBytes } from 'crypto';
import { AuctionService } from '../auctions/auction.service';
import { parseZapReceiptToBid, NOSTR_KIND_ZAP_RECEIPT } from '../auctions/auction.events';

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function makeBolt11WithPaymentHash(paymentHash: string): string {
  const words: number[] = [0, 0, 0, 0, 0, 0, 0]; // timestamp
  const hashWords = bech32.toWords(Buffer.from(paymentHash, 'hex'));
  const pTagCode = BECH32_CHARSET.indexOf('p');

  words.push(pTagCode);
  words.push((hashWords.length >> 5) & 31, hashWords.length & 31);
  words.push(...hashWords);
  words.push(...new Array(104).fill(0)); // fake signature payload

  return bech32.encode('lnbc10n', words, 5000);
}

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

  function trackPaidInvoice(
    auctionId: string,
    bidderPubkey: string,
    amountSats: number,
    bolt11: string,
    paymentHash: string,
  ) {
    service.trackInvoice({
      paymentHash,
      auctionId,
      bidderPubkey,
      amountSats,
      bolt11,
      paid: true,
    });
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

  it('enforces 10% minimum increment and extends by anti-sniping rule', async () => {
    setNowSeconds(1700000010);

    const { auction } = service.createAuction({
      name: 'q',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 500000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const preimage1 = randomBytes(32).toString('hex');
    const hash1 = createHash('sha256').update(Buffer.from(preimage1, 'hex')).digest('hex');
    const bolt11a = makeBolt11WithPaymentHash(hash1);

    trackPaidInvoice(auction.id, aliceHex, 150000, bolt11a, hash1);

    const firstBid = await service.ingestZapBid(auction.id, {
      id: 'zap-1',
      pubkey: aliceHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: 1700000200,
      content: '',
      tags: [
        ['e', auction.eventId],
        ['amount', String(150000 * 1000)],
        ['P', aliceHex],
        ['bolt11', bolt11a],
        ['preimage', preimage1],
      ],
    });

    expect(firstBid.bidAmountSats).toBe(150000);

    const preimage2 = randomBytes(32).toString('hex');
    const hash2 = createHash('sha256').update(Buffer.from(preimage2, 'hex')).digest('hex');
    const bolt11b = makeBolt11WithPaymentHash(hash2);
    trackPaidInvoice(auction.id, bobHex, 160000, bolt11b, hash2);

    await expect(
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
          ['bolt11', bolt11b],
          ['preimage', preimage2],
        ],
      }),
    ).rejects.toThrow(/minimum allowed is 165000/);

    const pre = service.getAuction(auction.id).auction.endsAt;

    const preimage3 = randomBytes(32).toString('hex');
    const hash3 = createHash('sha256').update(Buffer.from(preimage3, 'hex')).digest('hex');
    const bolt11c = makeBolt11WithPaymentHash(hash3);
    trackPaidInvoice(auction.id, carolHex, 200000, bolt11c, hash3);

    await service.ingestZapBid(auction.id, {
      id: 'zap-3',
      pubkey: carolHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: pre - 30,
      content: '200000',
      tags: [
        ['e', auction.eventId],
        ['amount', String(200000 * 1000)],
        ['P', carolHex],
        ['bolt11', bolt11c],
        ['preimage', preimage3],
      ],
    });

    const post = service.getAuction(auction.id).auction.endsAt;
    expect(post).toBe(pre + 600);
  });

  it('rejects bids with invalid preimage', async () => {
    setNowSeconds(1700000010);

    const { auction } = service.createAuction({
      name: 'qx',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 200000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const goodPreimage = randomBytes(32).toString('hex');
    const hash = createHash('sha256').update(Buffer.from(goodPreimage, 'hex')).digest('hex');
    const bolt11 = makeBolt11WithPaymentHash(hash);

    await expect(
      service.ingestZapBid(auction.id, {
        id: 'zap-invalid-preimage',
        pubkey: aliceHex,
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000200,
        content: '120000',
        tags: [
          ['e', auction.eventId],
          ['amount', String(120000 * 1000)],
          ['P', aliceHex],
          ['bolt11', bolt11],
          ['preimage', randomBytes(32).toString('hex')],
        ],
      }),
    ).rejects.toThrow(/invalid zap preimage/i);
  });

  it('accepts bid when invoice is already tracked as paid', async () => {
    setNowSeconds(1700000010);

    const { auction } = service.createAuction({
      name: 'qy',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 300000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const preimage = randomBytes(32).toString('hex');
    const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
    const bolt11 = makeBolt11WithPaymentHash(paymentHash);

    service.trackInvoice({
      paymentHash,
      auctionId: auction.id,
      bidderPubkey: bobHex,
      amountSats: 180000,
      bolt11,
      paid: true,
    });

    const bid = await service.ingestZapBid(auction.id, {
      id: 'zap-tracked-paid',
      pubkey: bobHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: 1700000200,
      content: '180000',
      tags: [
        ['e', auction.eventId],
        ['amount', String(180000 * 1000)],
        ['P', bobHex],
        ['bolt11', bolt11],
      ],
    });

    expect(bid.bidAmountSats).toBe(180000);
  });

  it('rejects bids for invoices that are still pending', async () => {
    setNowSeconds(1700000010);

    const { auction } = service.createAuction({
      name: 'qz',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 300000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const preimage = randomBytes(32).toString('hex');
    const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
    const bolt11 = makeBolt11WithPaymentHash(paymentHash);

    service.trackInvoice({
      paymentHash,
      auctionId: auction.id,
      bidderPubkey: aliceHex,
      amountSats: 150000,
      bolt11,
      paid: false,
    });

    await expect(
      service.ingestZapBid(auction.id, {
        id: 'zap-pending-invoice',
        pubkey: aliceHex,
        kind: NOSTR_KIND_ZAP_RECEIPT,
        created_at: 1700000200,
        content: '150000',
        tags: [
          ['e', auction.eventId],
          ['amount', String(150000 * 1000)],
          ['P', aliceHex],
          ['bolt11', bolt11],
          ['preimage', preimage],
        ],
      }),
    ).rejects.toThrow(/not yet marked paid/i);
  });

  it('settles to highest bid if reserve met', async () => {
    setNowSeconds(1700000010);
    const { auction } = service.createAuction({
      name: 'zz',
      auctionPubkey: 'auction-pubkey',
      startingPriceSats: 100000,
      reservePriceSats: 500000,
      startsAt: 1700000000,
      endsAt: 1700000600,
    });

    const preimage = randomBytes(32).toString('hex');
    const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
    const bolt11 = makeBolt11WithPaymentHash(paymentHash);
    trackPaidInvoice(auction.id, aliceHex, 550000, bolt11, paymentHash);

    await service.ingestZapBid(auction.id, {
      id: 'zap-a',
      pubkey: aliceHex,
      kind: NOSTR_KIND_ZAP_RECEIPT,
      created_at: 1700000100,
      content: '550000',
      tags: [
        ['e', auction.eventId],
        ['amount', String(550000 * 1000)],
        ['P', aliceHex],
        ['bolt11', bolt11],
        ['preimage', preimage],
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
