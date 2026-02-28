import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useContentFilters } from '../../hooks/useContentFilters';

interface FilterSectionProps<T extends string> {
  title: string;
  description: string;
  items: T[];
  placeholder?: string;
  emptyMessage: string;
  onAdd?: (item: string) => void;
  onRemove: (item: T) => void;
  renderItem?: (item: T) => ReactNode;
}

function FilterSection<T extends string>({
  title,
  description,
  items,
  placeholder,
  emptyMessage,
  onAdd,
  onRemove,
  renderItem,
}: FilterSectionProps<T>) {
  const [newItem, setNewItem] = useState('');

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="text-sm text-gray-400 mb-3">{description}</p>

      {onAdd ? (
        <div className="flex gap-2 mb-3">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-gray-700 rounded px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newItem.trim()) {
                onAdd(newItem.trim());
                setNewItem('');
              }
            }}
          />
          <button
            onClick={() => {
              if (newItem.trim()) {
                onAdd(newItem.trim());
                setNewItem('');
              }
            }}
            className="px-3 py-2 bg-cyan-600 rounded text-sm"
          >
            Add
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <div key={`${item}-${index}`} className="bg-gray-700 rounded-full px-3 py-1 flex items-center gap-2 text-sm">
              {renderItem ? renderItem(item) : <span>{item}</span>}
              <button onClick={() => onRemove(item)} className="text-gray-400 hover:text-red-400" aria-label={`remove ${item}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContentFiltersManager() {
  const { user } = useAuth();
  const { filters, saveFilters, syncStatus } = useContentFilters(user?.pubkey);

  const normalizedPubkeys = useMemo(() => filters.mutedPubkeys.map((p) => p.trim()).filter(Boolean), [filters.mutedPubkeys]);

  return (
    <div className="space-y-6">
      <FilterSection
        title="Muted Words & Phrases"
        description="Hide posts containing these words or phrases (e.g. 'breaking news', 'sponsored')"
        items={filters.mutedWords}
        placeholder="Add word or phrase to mute..."
        onAdd={(word) => void saveFilters({
          ...filters,
          mutedWords: [...filters.mutedWords, word.toLowerCase()],
        })}
        onRemove={(word) => void saveFilters({
          ...filters,
          mutedWords: filters.mutedWords.filter((w) => w !== word),
        })}
        emptyMessage="No muted words yet. Add words or phrases you don't want to see."
      />

      <FilterSection
        title="Muted Accounts"
        description="Hide all posts from these accounts"
        items={normalizedPubkeys}
        placeholder="Paste npub or hex pubkey to mute..."
        onAdd={(pubkey) => void saveFilters({
          ...filters,
          mutedPubkeys: [...filters.mutedPubkeys, pubkey.trim()],
        })}
        onRemove={(pubkey) => void saveFilters({
          ...filters,
          mutedPubkeys: filters.mutedPubkeys.filter((p) => p !== pubkey),
        })}
        emptyMessage="No muted accounts. You can mute accounts from their profile."
      />

      <FilterSection
        title="Muted Hashtags"
        description="Hide posts with these hashtags"
        items={filters.mutedHashtags}
        placeholder="Add hashtag to mute..."
        onAdd={(tag) => void saveFilters({
          ...filters,
          mutedHashtags: [...filters.mutedHashtags, tag.toLowerCase().replace('#', '')],
        })}
        onRemove={(tag) => void saveFilters({
          ...filters,
          mutedHashtags: filters.mutedHashtags.filter((t) => t !== tag),
        })}
        emptyMessage="No muted hashtags yet."
      />

      <FilterSection
        title="Muted Threads"
        description="Hide specific conversation threads"
        items={filters.mutedThreads}
        placeholder="Paste event id to mute thread..."
        onAdd={(eventId) => void saveFilters({
          ...filters,
          mutedThreads: [...filters.mutedThreads, eventId.trim()],
        })}
        onRemove={(eventId) => void saveFilters({
          ...filters,
          mutedThreads: filters.mutedThreads.filter((e) => e !== eventId),
        })}
        emptyMessage="No muted threads. You can mute threads from the post menu."
      />

      <div className="flex items-center gap-2 text-sm text-gray-400 mt-4">
        <span role="img" aria-label="encrypted" className="text-green-500">🔒</span>
        <span>Your filters are encrypted — only you can see them</span>
      </div>

      {syncStatus === 'syncing' ? (
        <div className="text-sm text-cyan-400">Syncing...</div>
      ) : null}
    </div>
  );
}
