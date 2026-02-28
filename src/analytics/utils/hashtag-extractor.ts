export function extractHashtags(content: string): string[] {
  const regex = /#(\w+)/g;
  const matches = content.matchAll(regex);
  return [...matches].map((m) => m[1].toLowerCase());
}

export function extractMentions(content: string): string[] {
  const regex = /nostr:(npub1[0-9a-z]+|note1[0-9a-z]+)/gi;
  const matches = content.matchAll(regex);
  return [...matches].map((m) => m[1].toLowerCase());
}

export function detectLanguage(content: string): string {
  const text = content.toLowerCase();
  if (!text.trim()) return 'unknown';

  const spanishHints = [' el ', ' la ', ' de ', ' que ', ' y '];
  const portugueseHints = [' você ', ' não ', ' para ', ' com ', ' uma '];
  const germanHints = [' der ', ' die ', ' und ', ' ist ', ' nicht '];

  const score = (hints: string[]) => hints.reduce((sum, hint) => sum + (text.includes(hint) ? 1 : 0), 0);

  const scores = [
    { lang: 'es', score: score(spanishHints) },
    { lang: 'pt', score: score(portugueseHints) },
    { lang: 'de', score: score(germanHints) },
  ].sort((a, b) => b.score - a.score);

  return scores[0].score > 0 ? scores[0].lang : 'en';
}
