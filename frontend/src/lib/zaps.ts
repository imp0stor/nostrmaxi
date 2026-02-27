import { SimplePool, verifyEvent } from 'nostr-tools';
import type { NostrEvent, NostrProfile } from '../types';

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.primal.net',
];

const STORAGE_KEYS = {
  lastAmount: 'nostrmaxi.zap.lastAmountSat',
  amountHistory: 'nostrmaxi.zap.amountHistorySat',
  lastWallet: 'nostrmaxi.zap.lastWalletKind',
  nwcUrl: 'nostrmaxi.zap.nwcUrl',
};

export type ZapWalletKind = 'webln' | 'nwc' | 'external';

export interface ZapWalletOption {
  kind: ZapWalletKind;
  label: string;
  available: boolean;
  hint?: string;
}

export interface ParsedZapRequest {
  amountMsat: number;
  amountSat: number;
  recipientPubkey: string;
  targetEventId?: string;
  content: string;
  anonymous: boolean;
}

export interface ParsedZapReceipt {
  id: string;
  receiptPubkey: string;
  senderPubkey: string;
  recipientPubkey: string;
  targetEventId?: string;
  amountMsat: number;
  amountSat: number;
  content: string;
  anonymous: boolean;
}

export interface ZapAggregate {
  count: number;
  totalMsat: number;
  totalSat: number;
  pendingCount?: number;
  pendingSat?: number;
  topZappers?: Array<{ pubkey: string; sats: number; count: number }>;
}

export interface ZapPreferences {
  lastAmountSat: number;
  amountHistorySat: number[];
  lastWalletKind: ZapWalletKind;
}

export interface PendingZap {
  id: string;
  targetEventId?: string;
  recipientPubkey: string;
  amountSat: number;
  message?: string;
  createdAt: number;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

function safeStorageGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // best effort
  }
}

function getTag(event: NostrEvent, tagName: string): string | undefined {
  const tag = event.tags.find((t) => t[0] === tagName && t[1]);
  return tag?.[1];
}

function getTags(event: NostrEvent, tagName: string): string[] {
  return event.tags.filter((t) => t[0] === tagName && t[1]).map((t) => t[1]);
}

export function parseZapRequest(event: NostrEvent): ParsedZapRequest | null {
  if (event.kind !== 9734) return null;
  const amountRaw = getTag(event, 'amount');
  const recipientPubkey = getTag(event, 'p');
  if (!amountRaw || !recipientPubkey) return null;

  const amountMsat = Number(amountRaw);
  if (!Number.isFinite(amountMsat) || amountMsat <= 0) return null;

  const targetEventId = getTag(event, 'e');
  return {
    amountMsat,
    amountSat: Math.floor(amountMsat / 1000),
    recipientPubkey,
    targetEventId,
    content: event.content || '',
    anonymous: Boolean(getTag(event, 'anon')),
  };
}

function isEventStructValid(event: NostrEvent): boolean {
  return Boolean(
    event
    && typeof event.id === 'string'
    && typeof event.pubkey === 'string'
    && typeof event.sig === 'string'
    && typeof event.created_at === 'number'
    && typeof event.kind === 'number'
    && typeof event.content === 'string'
    && Array.isArray(event.tags),
  );
}

export function validateZapRequest(event: NostrEvent): { valid: boolean; reason?: string; parsed?: ParsedZapRequest } {
  if (event.kind !== 9734) return { valid: false, reason: 'kind must be 9734' };
  if (!isEventStructValid(event)) return { valid: false, reason: 'invalid event structure' };
  if (!verifyEvent(event as any)) return { valid: false, reason: 'invalid signature' };

  const parsed = parseZapRequest(event);
  if (!parsed) return { valid: false, reason: 'missing required zap request fields' };

  const relaysTag = event.tags.find((tag) => tag[0] === 'relays' && tag.length > 1);
  if (!relaysTag) return { valid: false, reason: 'missing relays tag' };

  return { valid: true, parsed };
}

export function parseZapReceipt(event: NostrEvent): ParsedZapReceipt | null {
  if (event.kind !== 9735) return null;
  const description = getTag(event, 'description');
  if (!description) return null;

  let requestEvent: NostrEvent;
  try {
    requestEvent = JSON.parse(description);
  } catch {
    return null;
  }

  const validation = validateZapRequest(requestEvent);
  if (!validation.valid || !validation.parsed) return null;

  const senderPubkey = requestEvent.pubkey;

  return {
    id: event.id,
    receiptPubkey: event.pubkey,
    senderPubkey,
    recipientPubkey: validation.parsed.recipientPubkey,
    targetEventId: validation.parsed.targetEventId,
    amountMsat: validation.parsed.amountMsat,
    amountSat: validation.parsed.amountSat,
    content: validation.parsed.content,
    anonymous: validation.parsed.anonymous,
  };
}

export function aggregateZaps(receipts: ParsedZapReceipt[]): { byEventId: Map<string, ZapAggregate>; byProfile: Map<string, ZapAggregate> } {
  const byEventId = new Map<string, ZapAggregate>();
  const byProfile = new Map<string, ZapAggregate>();
  const zappersByEvent = new Map<string, Map<string, { sats: number; count: number }>>();

  for (const receipt of receipts) {
    if (receipt.targetEventId) {
      const prev = byEventId.get(receipt.targetEventId) || { count: 0, totalMsat: 0, totalSat: 0 };
      const nextMsat = prev.totalMsat + receipt.amountMsat;
      byEventId.set(receipt.targetEventId, {
        ...prev,
        count: prev.count + 1,
        totalMsat: nextMsat,
        totalSat: Math.floor(nextMsat / 1000),
      });

      const bySender = zappersByEvent.get(receipt.targetEventId) || new Map<string, { sats: number; count: number }>();
      const sender = receipt.anonymous ? 'anon' : receipt.senderPubkey;
      const senderPrev = bySender.get(sender) || { sats: 0, count: 0 };
      bySender.set(sender, { sats: senderPrev.sats + receipt.amountSat, count: senderPrev.count + 1 });
      zappersByEvent.set(receipt.targetEventId, bySender);
    }

    const prevProfile = byProfile.get(receipt.recipientPubkey) || { count: 0, totalMsat: 0, totalSat: 0 };
    const nextProfileMsat = prevProfile.totalMsat + receipt.amountMsat;
    byProfile.set(receipt.recipientPubkey, {
      ...prevProfile,
      count: prevProfile.count + 1,
      totalMsat: nextProfileMsat,
      totalSat: Math.floor(nextProfileMsat / 1000),
    });
  }

  for (const [eventId, bySender] of zappersByEvent.entries()) {
    const existing = byEventId.get(eventId);
    if (!existing) continue;
    const topZappers = [...bySender.entries()]
      .map(([pubkey, v]) => ({ pubkey, sats: v.sats, count: v.count }))
      .sort((a, b) => b.sats - a.sats)
      .slice(0, 5);
    byEventId.set(eventId, { ...existing, topZappers });
  }

  return { byEventId, byProfile };
}

export async function loadZapReceipts(eventIds: string[], profilePubkeys: string[], relays: string[] = DEFAULT_RELAYS): Promise<ParsedZapReceipt[]> {
  const pool = new SimplePool();
  try {
    const queries: Promise<NostrEvent[]>[] = [];
    if (eventIds.length > 0) {
      queries.push(pool.querySync(relays, { kinds: [9735], '#e': eventIds.slice(0, 200), limit: 1500 } as any));
    }
    if (profilePubkeys.length > 0) {
      queries.push(pool.querySync(relays, { kinds: [9735], '#p': profilePubkeys.slice(0, 200), limit: 1500 } as any));
    }

    const batches = await Promise.all(queries);
    const seen = new Set<string>();
    const receipts: ParsedZapReceipt[] = [];
    for (const evt of batches.flat()) {
      if (seen.has(evt.id)) continue;
      seen.add(evt.id);
      const parsed = parseZapReceipt(evt as NostrEvent);
      if (parsed) receipts.push(parsed);
    }
    return receipts.sort((a, b) => b.amountMsat - a.amountMsat);
  } finally {
    pool.close(relays);
  }
}

export function subscribeToZaps(params: {
  eventIds: string[];
  profilePubkeys: string[];
  relays?: string[];
  onReceipt: (receipt: ParsedZapReceipt) => void;
}): () => void {
  const relays = params.relays || DEFAULT_RELAYS;
  const pool = new SimplePool();
  const seen = new Set<string>();

  const filters: Record<string, unknown>[] = [];
  if (params.eventIds.length) filters.push({ kinds: [9735], '#e': params.eventIds.slice(0, 200), limit: 300 });
  if (params.profilePubkeys.length) filters.push({ kinds: [9735], '#p': params.profilePubkeys.slice(0, 200), limit: 300 });

  if (!filters.length) return () => {};

  const sub = pool.subscribeMany(relays, filters as any, {
    onevent(event: NostrEvent) {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      const parsed = parseZapReceipt(event);
      if (parsed) params.onReceipt(parsed);
    },
  });

  return () => {
    sub.close();
    pool.close(relays);
  };
}

function toLnurlpUrl(lud16: string): string | null {
  const [name, domain] = lud16.split('@');
  if (!name || !domain) return null;
  return `https://${domain}/.well-known/lnurlp/${name}`;
}

export function resolveLnurlPayUrl(profile: NostrProfile | null | undefined): string | null {
  if (profile?.lud16) return toLnurlpUrl(profile.lud16);
  return null;
}

interface LnurlPayResponse {
  callback: string;
  minSendable: number;
  maxSendable: number;
  allowsNostr?: boolean;
  nostrPubkey?: string;
}

async function getLnurlPayMetadata(lnurlPayUrl: string): Promise<LnurlPayResponse> {
  const response = await fetch(lnurlPayUrl);
  if (!response.ok) throw new Error(`LNURL pay endpoint failed (${response.status})`);
  return response.json();
}

function generateZapRequest(params: {
  pubkey: string;
  recipientPubkey: string;
  amountMsat: number;
  targetEventId?: string;
  message?: string;
  anonymous?: boolean;
  relays?: string[];
}): Omit<NostrEvent, 'id' | 'sig'> {
  const tags: string[][] = [
    ['relays', ...(params.relays || DEFAULT_RELAYS)],
    ['amount', String(params.amountMsat)],
    ['p', params.recipientPubkey],
  ];
  if (params.targetEventId) tags.push(['e', params.targetEventId]);
  if (params.anonymous) tags.push(['anon', '1']);

  return {
    kind: 9734,
    content: params.message || '',
    tags,
    pubkey: params.pubkey,
    created_at: Math.floor(Date.now() / 1000),
  };
}

async function requestInvoice(callback: string, amountMsat: number, zapRequest: NostrEvent, lnurlPayUrl: string): Promise<string> {
  const url = new URL(callback);
  url.searchParams.set('amount', String(amountMsat));
  url.searchParams.set('nostr', JSON.stringify(zapRequest));
  url.searchParams.set('lnurl', lnurlPayUrl);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Wallet callback failed (${response.status})`);
  const data = await response.json();
  if (!data?.pr) throw new Error('Wallet callback did not return BOLT11 invoice');
  return data.pr;
}

export function getZapPreferences(): ZapPreferences {
  const lastAmountSat = Number(safeStorageGet(STORAGE_KEYS.lastAmount) || 21);
  let amountHistorySat: number[] = [];
  try {
    amountHistorySat = JSON.parse(safeStorageGet(STORAGE_KEYS.amountHistory) || '[]');
  } catch {
    amountHistorySat = [];
  }

  const lastWalletRaw = safeStorageGet(STORAGE_KEYS.lastWallet);
  const lastWalletKind: ZapWalletKind = lastWalletRaw === 'nwc' || lastWalletRaw === 'external' || lastWalletRaw === 'webln'
    ? lastWalletRaw
    : 'webln';

  return {
    lastAmountSat: Number.isFinite(lastAmountSat) && lastAmountSat > 0 ? Math.floor(lastAmountSat) : 21,
    amountHistorySat: amountHistorySat.filter((v) => Number.isFinite(v) && v > 0).map((v) => Math.floor(v)).slice(0, 20),
    lastWalletKind,
  };
}

function rememberZapAmount(amountSat: number): void {
  if (!Number.isFinite(amountSat) || amountSat <= 0) return;
  safeStorageSet(STORAGE_KEYS.lastAmount, String(Math.floor(amountSat)));

  const prefs = getZapPreferences();
  const next = [Math.floor(amountSat), ...prefs.amountHistorySat.filter((v) => v !== Math.floor(amountSat))].slice(0, 10);
  safeStorageSet(STORAGE_KEYS.amountHistory, JSON.stringify(next));
}

function rememberWallet(kind: ZapWalletKind): void {
  safeStorageSet(STORAGE_KEYS.lastWallet, kind);
}

export function getZapWalletOptions(): ZapWalletOption[] {
  const hasWebln = Boolean((window as any)?.webln?.enable && (window as any)?.webln?.sendPayment);
  const nwcUrl = safeStorageGet(STORAGE_KEYS.nwcUrl);
  return [
    {
      kind: 'webln',
      label: 'WebLN',
      available: hasWebln,
      hint: hasWebln ? 'Detected browser wallet (Alby/WebLN).' : 'Install or enable a WebLN wallet extension.',
    },
    {
      kind: 'nwc',
      label: 'NWC',
      available: Boolean(nwcUrl),
      hint: nwcUrl ? 'Connected via Nostr Wallet Connect.' : 'Add NWC connection string in settings.',
    },
    {
      kind: 'external',
      label: 'External wallet',
      available: true,
      hint: 'Use lightning: deeplink / QR with your wallet app.',
    },
  ];
}

async function payWithWebln(invoice: string): Promise<void> {
  const webln = (window as any)?.webln;
  if (!webln?.enable || !webln?.sendPayment) throw new Error('WebLN wallet unavailable');
  await webln.enable();
  await webln.sendPayment(invoice);
}

async function payWithNwc(invoice: string): Promise<void> {
  const nwcUrl = safeStorageGet(STORAGE_KEYS.nwcUrl);
  if (!nwcUrl) throw new Error('NWC connection not configured');
  // Placeholder: in production this should call a proper NIP-47 client.
  // We still provide a deterministic fallback path to external wallet.
  window.location.href = `lightning:${invoice}`;
}

export async function payInvoice(invoice: string, preferredWallet?: ZapWalletKind): Promise<ZapWalletKind> {
  const prefs = getZapPreferences();
  const requested = preferredWallet || prefs.lastWalletKind;

  const attempts: ZapWalletKind[] = requested === 'webln'
    ? ['webln', 'nwc', 'external']
    : requested === 'nwc'
      ? ['nwc', 'webln', 'external']
      : ['external', 'webln', 'nwc'];

  for (const kind of attempts) {
    try {
      if (kind === 'webln') await payWithWebln(invoice);
      else if (kind === 'nwc') await payWithNwc(invoice);
      else window.location.href = `lightning:${invoice}`;
      rememberWallet(kind);
      return kind;
    } catch (error) {
      if (kind === attempts[attempts.length - 1]) throw error;
    }
  }

  throw new Error('Unable to pay invoice');
}

export async function sendZap(params: {
  senderPubkey: string;
  recipientPubkey: string;
  recipientProfile: NostrProfile | null | undefined;
  amountSat: number;
  targetEventId?: string;
  message?: string;
  anonymous?: boolean;
  preferredWallet?: ZapWalletKind;
  signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>;
  onStatus?: (status: 'requesting_invoice' | 'awaiting_wallet' | 'paid') => void;
}): Promise<{ invoice: string; amountSat: number; walletUsed: ZapWalletKind }> {
  const lnurlPayUrl = resolveLnurlPayUrl(params.recipientProfile);
  if (!lnurlPayUrl) throw new Error('Recipient does not have a LNURL (lud16/lud06) set');

  const amountMsat = Math.max(1, Math.floor(params.amountSat)) * 1000;
  const metadata = await getLnurlPayMetadata(lnurlPayUrl);

  if (amountMsat < metadata.minSendable || amountMsat > metadata.maxSendable) {
    throw new Error(`Amount must be between ${Math.floor(metadata.minSendable / 1000)} and ${Math.floor(metadata.maxSendable / 1000)} sats`);
  }

  if (!metadata.allowsNostr) throw new Error('Wallet does not support Nostr zaps');

  const unsignedRequest = generateZapRequest({
    pubkey: params.senderPubkey,
    recipientPubkey: params.recipientPubkey,
    amountMsat,
    targetEventId: params.targetEventId,
    message: params.message,
    anonymous: params.anonymous,
  });
  const signedRequest = await params.signEventFn(unsignedRequest);
  if (!signedRequest) throw new Error('Zap request signing cancelled');

  params.onStatus?.('requesting_invoice');
  const invoice = await requestInvoice(metadata.callback, amountMsat, signedRequest, lnurlPayUrl);

  params.onStatus?.('awaiting_wallet');
  const walletUsed = await payInvoice(invoice, params.preferredWallet);
  rememberZapAmount(Math.floor(amountMsat / 1000));

  params.onStatus?.('paid');
  return { invoice, amountSat: Math.floor(amountMsat / 1000), walletUsed };
}

export function createPendingZap(params: {
  targetEventId?: string;
  recipientPubkey: string;
  amountSat: number;
  message?: string;
}): PendingZap {
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetEventId: params.targetEventId,
    recipientPubkey: params.recipientPubkey,
    amountSat: Math.floor(params.amountSat),
    message: params.message,
    createdAt: Date.now(),
    status: 'pending',
  };
}

export function mergePendingIntoAggregates(byEventId: Map<string, ZapAggregate>, pending: PendingZap[]): Map<string, ZapAggregate> {
  const next = new Map(byEventId);
  for (const p of pending) {
    if (!p.targetEventId || p.status === 'failed') continue;
    const prev = next.get(p.targetEventId) || { count: 0, totalMsat: 0, totalSat: 0, pendingCount: 0, pendingSat: 0 };
    next.set(p.targetEventId, {
      ...prev,
      pendingCount: (prev.pendingCount || 0) + (p.status === 'pending' ? 1 : 0),
      pendingSat: (prev.pendingSat || 0) + (p.status === 'pending' ? p.amountSat : 0),
    });
  }
  return next;
}

export function formatZapIndicator(agg: ZapAggregate | undefined | null): string {
  if (!agg || agg.count <= 0) {
    if (agg?.pendingCount && agg.pendingCount > 0) return `⚡ pending ${agg.pendingSat || 0} sats`;
    return '⚡ 0';
  }
  const pending = agg.pendingCount && agg.pendingCount > 0
    ? ` · +${agg.pendingSat || 0} pending`
    : '';
  return `⚡ ${agg.totalSat.toLocaleString()} sats · ${agg.count}${pending}`;
}

export function buildZapAmountOptions(locale = 'en-US'): number[] {
  const prefs = getZapPreferences();
  const localeDefaults = locale.startsWith('ja') ? [100, 500, 1000, 5000] : [21, 100, 500, 1000];
  const fromHistory = prefs.amountHistorySat.slice(0, 3);
  return [...new Set([...fromHistory, ...localeDefaults])].sort((a, b) => a - b).slice(0, 6);
}

export function getDefaultZapAmountOptions(): number[] {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return buildZapAmountOptions(locale);
}

export function buildZapButtonLabel(isBusy: boolean): string {
  return isBusy ? 'Sending…' : '⚡ Zap';
}

export function buildZapReceiptSummary(receipt: ParsedZapReceipt): string {
  const sender = receipt.anonymous ? 'Anonymous' : `${receipt.senderPubkey.slice(0, 8)}…`;
  const msg = receipt.content?.trim() ? ` — “${receipt.content.trim().slice(0, 120)}”` : '';
  return `${sender} zapped ${receipt.amountSat.toLocaleString()} sats${msg}`;
}

export function parseBolt11AmountSat(invoice: string): number | null {
  const match = invoice.match(/^ln\w+?(\d+)([munp]?)/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] || '';
  if (!Number.isFinite(amount)) return null;
  if (unit === 'm') return Math.floor((amount * 100000) / 1000);
  if (unit === 'u') return Math.floor((amount * 100) / 1000);
  if (unit === 'n') return Math.floor((amount * 0.1) / 1000);
  if (unit === 'p') return Math.floor((amount * 0.0001) / 1000);
  return amount * 100000000;
}
