const mdSignal = /(^|\n)\s{0,3}(#{1,6}\s+|>\s+|[-*+]\s+|\d+\.\s+)|\*\*[^\n]+\*\*|__[^\n]+__|(?<!\*)\*[^\n*]+\*(?!\*)|(?<!_)_[^\n_]+_(?!_)|~~[^\n]+~~|`[^`\n]+`|```[\s\S]*?```|\[[^\]]+\]\(https?:\/\/[^\s)]+\)/;
const markdownDetectionCache = new Map<string, boolean>();

export function hasMarkdown(text: string): boolean {
  if (!text) return false;
  if (markdownDetectionCache.has(text)) return markdownDetectionCache.get(text)!;
  const detected = mdSignal.test(text);
  markdownDetectionCache.set(text, detected);
  if (markdownDetectionCache.size > 500) {
    const first = markdownDetectionCache.keys().next().value;
    if (first) markdownDetectionCache.delete(first);
  }
  return detected;
}
