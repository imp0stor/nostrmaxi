import { SimplePool } from 'nostr-tools';
import type { NostrEvent } from '../types';

export type MuteMatchMode = 'substring' | 'whole-word' | 'regex';
export type MuteScope = 'content' | 'hashtags' | 'urls' | 'displayNames';
export type MutePrivacyMode = 'local' | 'public' | 'encrypted';

export interface MuteRule {
  id: string;
  value: string;
  mode: MuteMatchMode;
  caseSensitive?: boolean;
  scopes: ReadonlyArray<MuteScope>;
  expiresAt?: number; // unix seconds
  createdAt: number;
}

export interface MuteSettings {
  enabled: boolean;
  strictReplies: boolean;
  strictQuotes: boolean;
  privacyMode: MutePrivacyMode;
  rules: MuteRule[];
}

export interface MuteTarget {
  event: NostrEvent;
  displayName?: string;
  quotedContents?: string[];
}

const STORAGE_PREFIX = 'nostrmaxi.muteWords';
export const MUTE_LIST_KIND = 10000;

const DEFAULT_SETTINGS: MuteSettings = {
  enabled: true,
  strictReplies: true,
  strictQuotes: true,
  privacyMode: 'local',
  rules: [],
};

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net'];

export function getMuteStorageKey(pubkey?: string): string {
  return `${STORAGE_PREFIX}:${pubkey || 'anon'}`;
}

export function loadMuteSettings(pubkey?: string): MuteSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(getMuteStorageKey(pubkey));
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as MuteSettings;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      rules: (parsed.rules || []).filter((r) => !r.expiresAt || r.expiresAt > Math.floor(Date.now() / 1000)),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveMuteSettings(settings: MuteSettings, pubkey?: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMuteStorageKey(pubkey), JSON.stringify(settings));
}

export function upsertMuteRule(settings: MuteSettings, partial: Omit<MuteRule, 'id' | 'createdAt'> & { id?: string }): MuteSettings {
  const nextRule: MuteRule = {
    id: partial.id || `mute-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Math.floor(Date.now() / 1000),
    caseSensitive: false,
    ...partial,
  };
  const existingIdx = settings.rules.findIndex((r) => r.id === nextRule.id);
  const rules = existingIdx >= 0
    ? settings.rules.map((r, idx) => idx === existingIdx ? { ...r, ...nextRule } : r)
    : [nextRule, ...settings.rules];
  return { ...settings, rules };
}

export function removeMuteRule(settings: MuteSettings, id: string): MuteSettings {
  return { ...settings, rules: settings.rules.filter((r) => r.id !== id) };
}

export function exportMuteSettings(settings: MuteSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function importMuteSettings(raw: string, current: MuteSettings): MuteSettings {
  const parsed = JSON.parse(raw) as Partial<MuteSettings>;
  const rules = (parsed.rules || [])
    .filter((r): r is MuteRule => Boolean(r && r.value))
    .map((r) => ({
      id: r.id || `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      value: r.value,
      mode: r.mode || 'substring',
      scopes: (r.scopes?.length ? r.scopes : ['content']).filter((scope): scope is MuteScope => (
        scope === 'content' || scope === 'hashtags' || scope === 'urls' || scope === 'displayNames'
      )),
      caseSensitive: Boolean(r.caseSensitive),
      expiresAt: r.expiresAt,
      createdAt: r.createdAt || Math.floor(Date.now() / 1000),
    }));

  return {
    ...current,
    ...parsed,
    rules,
  };
}

function normalize(value: string, caseSensitive?: boolean): string {
  return caseSensitive ? value : value.toLowerCase();
}

function safeRegExp(pattern: string, caseSensitive?: boolean): RegExp | null {
  try {
    return new RegExp(pattern, caseSensitive ? undefined : 'i');
  } catch {
    return null;
  }
}

function matchesRule(input: string, rule: MuteRule): boolean {
  if (!input) return false;
  const source = normalize(input, rule.caseSensitive);
  const needle = normalize(rule.value, rule.caseSensitive);

  if (rule.mode === 'regex') {
    const regex = safeRegExp(rule.value, rule.caseSensitive);
    return Boolean(regex?.test(input));
  }

  if (rule.mode === 'whole-word') {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|\\W)${escaped}(?=\\W|$)`, rule.caseSensitive ? undefined : 'i');
    return re.test(input);
  }

  return source.includes(needle);
}

function eventHashtags(event: NostrEvent): string[] {
  const fromTags = (event.tags || []).filter((t) => t[0] === 't' && t[1]).map((t) => t[1]);
  const fromContent = Array.from(event.content.matchAll(/#([a-zA-Z0-9_]+)/g)).map((m) => m[1]);
  return [...new Set([...fromTags, ...fromContent])];
}

function eventUrls(event: NostrEvent): string[] {
  const matches = event.content.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  const domains = matches.map((raw) => {
    try {
      const withScheme = raw.startsWith('http') ? raw : `https://${raw}`;
      return new URL(withScheme).hostname;
    } catch {
      return raw;
    }
  });
  return [...new Set([...matches, ...domains])];
}

export interface MuteEvaluation {
  muted: boolean;
  ruleIds: string[];
}

export function evaluateMute(target: MuteTarget, settings: MuteSettings): MuteEvaluation {
  if (!settings.enabled) return { muted: false, ruleIds: [] };
  const now = Math.floor(Date.now() / 1000);
  const activeRules = settings.rules.filter((r) => !r.expiresAt || r.expiresAt > now);
  if (activeRules.length === 0) return { muted: false, ruleIds: [] };

  const hashtags = eventHashtags(target.event);
  const urls = eventUrls(target.event);
  const displayName = target.displayName || '';
  const quoted = settings.strictQuotes ? (target.quotedContents || []) : [];

  const matched = activeRules.filter((rule) => {
    if (rule.scopes.includes('content')) {
      if (matchesRule(target.event.content, rule)) return true;
      if (quoted.some((content) => matchesRule(content, rule))) return true;
      if (settings.strictReplies && target.event.tags.some((t) => t[0] === 'e') && matchesRule(target.event.content, rule)) return true;
    }
    if (rule.scopes.includes('hashtags') && hashtags.some((tag) => matchesRule(tag, rule))) return true;
    if (rule.scopes.includes('urls') && urls.some((url) => matchesRule(url, rule))) return true;
    if (rule.scopes.includes('displayNames') && matchesRule(displayName, rule)) return true;
    return false;
  });

  return { muted: matched.length > 0, ruleIds: matched.map((r) => r.id) };
}

function toTags(rule: MuteRule): string[][] {
  return [
    ['word', rule.value],
    ['mode', rule.mode],
    ['scope', rule.scopes.join(',')],
    ['case', rule.caseSensitive ? '1' : '0'],
    ...(rule.expiresAt ? [['expires', String(rule.expiresAt)]] : []),
    ['rid', rule.id],
  ];
}

function fromEvent(event: NostrEvent): MuteSettings {
  const entries: MuteRule[] = [];
  let idx = 0;
  while (idx < event.tags.length) {
    const tag = event.tags[idx];
    if (tag?.[0] !== 'word') {
      idx += 1;
      continue;
    }
    const value = tag[1] || '';
    const mode = (event.tags[idx + 1]?.[0] === 'mode' ? event.tags[idx + 1][1] : 'substring') as MuteMatchMode;
    const scopes = (event.tags[idx + 2]?.[0] === 'scope' ? event.tags[idx + 2][1] : 'content').split(',') as MuteScope[];
    const caseSensitive = event.tags[idx + 3]?.[0] === 'case' ? event.tags[idx + 3][1] === '1' : false;
    const expiresAt = event.tags[idx + 4]?.[0] === 'expires' ? Number(event.tags[idx + 4][1]) : undefined;
    const ridTag = event.tags.find((t) => t[0] === 'rid' && t[1]);
    entries.push({
      id: ridTag?.[1] || `remote-${idx}`,
      value,
      mode,
      scopes,
      caseSensitive,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
      createdAt: event.created_at,
    });
    idx += 1;
  }

  return {
    ...DEFAULT_SETTINGS,
    enabled: !event.tags.some((t) => t[0] === 'enabled' && t[1] === '0'),
    strictReplies: event.tags.some((t) => t[0] === 'strictReplies' && t[1] === '1'),
    strictQuotes: !event.tags.some((t) => t[0] === 'strictQuotes' && t[1] === '0'),
    privacyMode: event.tags.some((t) => t[0] === 'privacy' && t[1] === 'encrypted') ? 'encrypted' : 'public',
    rules: entries.filter((r) => r.value),
  };
}

export async function publishMuteSettingsToNostr(
  settings: MuteSettings,
  pubkey: string,
  signEventFn: (evt: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>,
  publishFn: (evt: NostrEvent) => Promise<any>,
): Promise<boolean> {
  const payload = {
    enabled: settings.enabled,
    strictReplies: settings.strictReplies,
    strictQuotes: settings.strictQuotes,
    rules: settings.rules,
  };

  let content = '';
  let tags: string[][] = [
    ['d', 'mute-words'],
    ['client', 'nostrmaxi'],
    ['enabled', settings.enabled ? '1' : '0'],
    ['strictReplies', settings.strictReplies ? '1' : '0'],
    ['strictQuotes', settings.strictQuotes ? '1' : '0'],
    ['privacy', settings.privacyMode],
  ];

  if (settings.privacyMode === 'encrypted') {
    const nip04 = window?.nostr?.nip04;
    if (!nip04) throw new Error('NIP-04 encryption not available in signer');
    content = await nip04.encrypt(pubkey, JSON.stringify(payload));
    tags.push(['encrypted', 'nip04']);
  } else {
    tags = [...tags, ...settings.rules.flatMap((rule) => toTags(rule))];
  }

  const unsigned: Omit<NostrEvent, 'id' | 'sig'> = {
    kind: MUTE_LIST_KIND,
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };

  const signed = await signEventFn(unsigned);
  if (!signed) return false;
  const result = await publishFn(signed);
  return Boolean(result?.success);
}

export async function syncMuteSettingsFromNostr(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<MuteSettings | null> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(relays, { kinds: [MUTE_LIST_KIND], authors: [pubkey], limit: 20 });
    if (events.length === 0) return null;
    const latest = events.sort((a, b) => b.created_at - a.created_at)[0] as NostrEvent;
    const encrypted = latest.tags.some((t) => t[0] === 'encrypted' && t[1] === 'nip04');
    if (!encrypted) return fromEvent(latest);

    const nip04 = window?.nostr?.nip04;
    if (!nip04 || !latest.content) return null;
    const decrypted = await nip04.decrypt(pubkey, latest.content);
    const payload = JSON.parse(decrypted) as Partial<MuteSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...payload,
      privacyMode: 'encrypted',
      rules: payload.rules || [],
    };
  } catch {
    return null;
  } finally {
    pool.close(relays);
  }
}
