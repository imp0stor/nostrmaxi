interface ProfileContext {
  selectedCategories: string[];
  selectedFeeds: string[];
  website?: string;
  profession?: string;
}

interface Props {
  context: ProfileContext;
}

function generateBioPrompt(context: ProfileContext): string {
  return `Write a short, engaging Nostr bio (under 160 characters) for someone who:
- Is interested in: ${context.selectedCategories.join(', ') || 'nostr'}
- Follows topics like: ${context.selectedFeeds.join(', ') || 'tech'}
${context.website ? `- Has website: ${context.website}` : ''}
${context.profession ? `- Works in: ${context.profession}` : ''}

Make it personal, friendly, and authentic. No hashtags.`;
}

export function AIBioHelper({ context }: Props) {
  const openAIHelper = (platform: 'grok' | 'chatgpt' | 'claude') => {
    const prompt = encodeURIComponent(generateBioPrompt(context));
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
      <div className="flex flex-wrap gap-2">
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('grok')}>🤖 Ask Grok</button>
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('chatgpt')}>💬 Ask ChatGPT</button>
        <button type="button" className="cy-btn-secondary text-xs" onClick={() => openAIHelper('claude')}>🧠 Ask Claude</button>
      </div>
      <p className="text-[11px] text-gray-400">Opens in a new tab with a pre-filled prompt.</p>
    </div>
  );
}
