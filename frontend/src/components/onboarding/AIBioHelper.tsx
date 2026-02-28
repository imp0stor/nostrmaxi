import type { ExternalIdentity } from '../../hooks/useOnboarding';

interface ProfileContext {
  selectedCategories: string[];
  selectedFeeds: string[];
  interests: string[];
  website?: string;
  externalIdentities: ExternalIdentity[];
}

interface Props {
  context: ProfileContext;
}

function getLinkedAccountContext(identity: ExternalIdentity): string | null {
  if (identity.platform === 'twitter') return `Active on Twitter as @${identity.identity}`;
  if (identity.platform === 'github') return `Developer on GitHub: ${identity.identity}`;
  if (identity.platform === 'youtube') return 'Creates content on YouTube';
  if (identity.platform === 'linkedin') return `Professional on LinkedIn: ${identity.identity}`;
  if (identity.platform === 'telegram') return `Reachable on Telegram: ${identity.identity}`;
  return `${identity.platform}: ${identity.identity}`;
}

function generateEnhancedBioPrompt(context: ProfileContext): string {
  const lines: string[] = [];

  context.externalIdentities.forEach((item) => {
    const line = getLinkedAccountContext(item);
    if (line) lines.push(line);
  });

  if (context.website) lines.push(`Runs website: ${context.website}`);
  if (context.interests.length) lines.push(`Interested in: ${context.interests.join(', ')}`);
  if (context.selectedCategories.length) lines.push(`Follows topics: ${context.selectedCategories.join(', ')}`);
  if (context.selectedFeeds.length) lines.push(`Reads feeds like: ${context.selectedFeeds.join(', ')}`);

  return `Write a short, authentic Nostr bio (under 160 chars) for someone who:
${lines.map((c) => `- ${c}`).join('\n') || '- Is active in the Nostr community'}

Be personal and genuine. No hashtags.`;
}

export function AIBioHelper({ context }: Props) {
  const openAIHelper = (platform: 'grok' | 'chatgpt' | 'claude') => {
    const prompt = encodeURIComponent(generateEnhancedBioPrompt(context));
    const urls = {
      grok: `https://x.com/i/grok?text=${prompt}`,
      chatgpt: `https://chat.openai.com/?q=${prompt}`,
      claude: `https://claude.ai/new?q=${prompt}`,
    };

    window.open(urls[platform], '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-300">Need help writing your bio?</p>
      <p className="text-[11px] text-cyan-300">The more you add, the better your AI bio suggestions!</p>
      <p className="text-[11px] text-gray-400">Link more accounts for better AI suggestions.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('grok')}>🤖 Ask Grok</button>
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('chatgpt')}>💬 Ask ChatGPT</button>
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('claude')}>🧠 Ask Claude</button>
      </div>
      <p className="text-[11px] text-gray-400">Opens in a new tab with a pre-filled prompt.</p>
    </div>
  );
}
