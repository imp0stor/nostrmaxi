import { useState } from 'react';
import type { CustomFeedDefinition } from '../../lib/social';

interface FeedDesignTabProps {
  onCreateFeed: (feed: CustomFeedDefinition) => void;
}

export function FeedDesignTab({ onCreateFeed }: FeedDesignTabProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topics, setTopics] = useState('');
  const [authors, setAuthors] = useState('');
  const [includeReplies, setIncludeReplies] = useState(true);

  const handleCreate = () => {
    if (!title.trim()) return;

    const id = `custom-${Date.now()}`;
    onCreateFeed({
      id,
      title: title.trim(),
      description: description.trim(),
      hashtags: topics
        .split(',')
        .map((topic) => topic.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
      authors: authors
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean),
      includeReplies,
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Create a custom feed with your own filters</p>

      <div className="space-y-3">
        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          placeholder="Feed name"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          placeholder="Topics / hashtags (comma-separated)"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
        />

        <input
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
          placeholder="Authors / npubs (comma-separated)"
          value={authors}
          onChange={(e) => setAuthors(e.target.value)}
        />

        <label className="flex items-center gap-3 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={includeReplies}
            onChange={(e) => setIncludeReplies(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
          />
          Include replies
        </label>
      </div>

      <button
        onClick={handleCreate}
        disabled={!title.trim()}
        className="w-full py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 font-medium transition"
      >
        Create Feed
      </button>
    </div>
  );
}
