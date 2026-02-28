import { useEffect, useState } from 'react';
import type { CustomFeedDefinition } from '../../lib/social';
import { FeedDiscoverTab } from './FeedDiscoverTab';
import { FeedDesignTab } from './FeedDesignTab';

interface FeedDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  onAddFeed: (feed: CustomFeedDefinition) => void;
  userProfile?: { interests?: string[]; following?: string[] };
  discoverableFeeds: CustomFeedDefinition[];
}

export function FeedDiscoveryModal({ open, onClose, onAddFeed, userProfile, discoverableFeeds }: FeedDiscoveryModalProps) {
  const [mode, setMode] = useState<'discover' | 'design'>('discover');

  useEffect(() => {
    if (!open) setMode('discover');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'discover' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setMode('discover')}
            >
              Discover
            </button>
            <button
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${mode === 'design' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setMode('design')}
            >
              Design
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl" aria-label="Close feed modal">×</button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {mode === 'discover' ? (
            <FeedDiscoverTab feeds={discoverableFeeds} userProfile={userProfile} onAddFeed={onAddFeed} />
          ) : (
            <FeedDesignTab onCreateFeed={onAddFeed} />
          )}
        </div>
      </div>
    </div>
  );
}
