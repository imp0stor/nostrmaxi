import { evaluateMute, importMuteSettings, upsertMuteRule, type MuteSettings } from '../src/lib/muteWords';
import type { NostrEvent } from '../src/types';

function event(content: string, tags: string[][] = []): NostrEvent {
  return {
    id: `evt-${Math.random()}`,
    pubkey: 'pub',
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content,
    sig: 'sig',
  };
}

const base: MuteSettings = {
  enabled: true,
  strictReplies: true,
  strictQuotes: true,
  privacyMode: 'local',
  rules: [],
};

describe('mute words matching', () => {
  test('matches substring case-insensitive by default', () => {
    const settings = upsertMuteRule(base, { value: 'bitcoin', mode: 'substring', scopes: ['content'], caseSensitive: false });
    const result = evaluateMute({ event: event('I like BitCoin') }, settings);
    expect(result.muted).toBe(true);
  });

  test('matches whole-word without muting partials', () => {
    const settings = upsertMuteRule(base, { value: 'cat', mode: 'whole-word', scopes: ['content'], caseSensitive: false });
    expect(evaluateMute({ event: event('that cat is here') }, settings).muted).toBe(true);
    expect(evaluateMute({ event: event('concatenate strings') }, settings).muted).toBe(false);
  });

  test('matches regex and url/domain scopes', () => {
    const settings = upsertMuteRule(base, { value: 'spam\\.example', mode: 'regex', scopes: ['urls'], caseSensitive: false });
    const result = evaluateMute({ event: event('visit https://spam.example/abc') }, settings);
    expect(result.muted).toBe(true);
  });

  test('matches display names and quoted content', () => {
    const settings = upsertMuteRule(base, { value: 'scammer', mode: 'substring', scopes: ['displayNames', 'content'], caseSensitive: false });
    expect(evaluateMute({ event: event('hello'), displayName: 'Top Scammer' }, settings).muted).toBe(true);
    expect(evaluateMute({ event: event('hello'), quotedContents: ['this contains scammer text'] }, settings).muted).toBe(true);
  });
});

describe('mute persistence import/export shape', () => {
  test('imports valid JSON payload preserving rules', () => {
    const imported = importMuteSettings(JSON.stringify({
      enabled: true,
      rules: [{ value: 'abc', mode: 'substring', scopes: ['content'] }],
    }), base);

    expect(imported.rules).toHaveLength(1);
    expect(imported.rules[0].value).toBe('abc');
  });
});

describe('mute filtering performance', () => {
  test('evaluates 2000 events under 250ms on CI baseline', () => {
    const settings: MuteSettings = {
      ...base,
      rules: Array.from({ length: 25 }).map((_, i): MuteSettings['rules'][number] => ({
        id: `r-${i}`,
        value: `mute-${i}`,
        mode: 'substring',
        scopes: ['content', 'hashtags', 'urls', 'displayNames'],
        caseSensitive: false,
        createdAt: Math.floor(Date.now() / 1000),
      })),
    };

    const events = Array.from({ length: 2000 }).map((_, i) => event(`post ${i} with mute-${i % 20}`));
    const started = Date.now();
    const count = events.filter((evt) => evaluateMute({ event: evt, displayName: 'user' }, settings).muted).length;
    const elapsed = Date.now() - started;

    expect(count).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(250);
  });
});
