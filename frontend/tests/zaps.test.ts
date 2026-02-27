import { finalizeEvent } from 'nostr-tools';
import { aggregateZaps, buildZapAmountOptions, buildZapReceiptSummary, formatZapIndicator, mergePendingIntoAggregates, parseZapReceipt, parseZapRequest, validateZapRequest } from '../src/lib/zaps';

const sk = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1));

function signedEvent(kind: number, tags: string[][], content = ''): any {
  return finalizeEvent({
    kind,
    created_at: 1700000000,
    tags,
    content,
  } as any, sk);
}

describe('NIP-57 zap parsing', () => {
  it('parses and validates kind 9734 zap requests', () => {
    const request = signedEvent(9734, [
      ['relays', 'wss://relay.damus.io'],
      ['amount', '21000'],
      ['p', 'f'.repeat(64)],
      ['e', 'e'.repeat(64)],
    ], 'nice post');

    const validation = validateZapRequest(request);
    expect(validation.valid).toBe(true);

    const parsed = parseZapRequest(request)!;
    expect(parsed.amountMsat).toBe(21000);
    expect(parsed.amountSat).toBe(21);
    expect(parsed.recipientPubkey).toBe('f'.repeat(64));
    expect(parsed.targetEventId).toBe('e'.repeat(64));
    expect(parsed.content).toBe('nice post');
  });

  it('parses kind 9735 receipts by reading embedded zap request description', () => {
    const request = signedEvent(9734, [
      ['relays', 'wss://relay.damus.io'],
      ['amount', '42000'],
      ['p', 'a'.repeat(64)],
      ['e', 'b'.repeat(64)],
    ]);

    const receipt = signedEvent(9735, [
      ['description', JSON.stringify(request)],
      ['bolt11', 'lnbc1dummy'],
      ['p', 'a'.repeat(64)],
      ['e', 'b'.repeat(64)],
    ]);

    const parsed = parseZapReceipt(receipt)!;
    expect(parsed.recipientPubkey).toBe('a'.repeat(64));
    expect(parsed.targetEventId).toBe('b'.repeat(64));
    expect(parsed.senderPubkey).toBe(request.pubkey);
    expect(parsed.amountSat).toBe(42);
  });

  it('aggregates sats and counts for event + profile totals', () => {
    const receipts = [
      { id: '1', receiptPubkey: 'x', senderPubkey: 's1', recipientPubkey: 'p1', targetEventId: 'e1', amountMsat: 1000, amountSat: 1, content: '', anonymous: false },
      { id: '2', receiptPubkey: 'y', senderPubkey: 's2', recipientPubkey: 'p1', targetEventId: 'e1', amountMsat: 2000, amountSat: 2, content: '', anonymous: false },
      { id: '3', receiptPubkey: 'z', senderPubkey: 's3', recipientPubkey: 'p1', targetEventId: 'e2', amountMsat: 3000, amountSat: 3, content: '', anonymous: false },
    ];

    const { byEventId, byProfile } = aggregateZaps(receipts);
    expect(byEventId.get('e1')).toMatchObject({ count: 2, totalMsat: 3000, totalSat: 3 });
    expect(byEventId.get('e2')).toMatchObject({ count: 1, totalMsat: 3000, totalSat: 3 });
    expect(byProfile.get('p1')).toMatchObject({ count: 3, totalMsat: 6000, totalSat: 6 });
  });

  it('formats visual zap indicator text with ⚡', () => {
    expect(formatZapIndicator(undefined)).toBe('⚡ 0');
    expect(formatZapIndicator({ count: 12, totalMsat: 21000000, totalSat: 21000 })).toBe('⚡ 21,000 sats · 12');
  });

  it('merges optimistic pending zaps into aggregate badge', () => {
    const base = new Map<string, any>([['evt-1', { count: 2, totalMsat: 5000, totalSat: 5 }]]);
    const merged = mergePendingIntoAggregates(base, [
      { id: 'p1', targetEventId: 'evt-1', recipientPubkey: 'abc', amountSat: 21, createdAt: 1, status: 'pending' },
    ] as any);
    expect(formatZapIndicator(merged.get('evt-1'))).toContain('+21 pending');
  });

  it('builds receipt summaries and amount options', () => {
    const summary = buildZapReceiptSummary({
      id: 'r1',
      receiptPubkey: 'r',
      senderPubkey: '0123456789abcdef',
      recipientPubkey: 'f'.repeat(64),
      amountMsat: 21000,
      amountSat: 21,
      content: 'great post',
      anonymous: false,
    });
    expect(summary).toContain('zapped 21 sats');
    expect(buildZapAmountOptions('en-US')).toEqual(expect.arrayContaining([21, 100, 500, 1000]));
  });
});
