import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSubscriptions } from '../../hooks/useSubscriptions';

function FilterSection({
  items,
  placeholder,
  onAdd,
  emptyMessage,
}: {
  items: string[];
  placeholder: string;
  onAdd: (value: string) => void;
  emptyMessage: string;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="cy-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) {
              onAdd(value.trim());
              setValue('');
            }
          }}
        />
        <button
          className="cy-btn-secondary"
          onClick={() => {
            if (!value.trim()) return;
            onAdd(value.trim());
            setValue('');
          }}
        >
          Add
        </button>
      </div>
      {items.length === 0 ? <p className="text-gray-500 italic text-sm">{emptyMessage}</p> : null}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="cy-chip text-sm">#{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SubscriptionSettings() {
  const { user } = useAuth();
  const { topicSubs, userSubs, subscribeToTopic, subscribeToUser } = useSubscriptions(user?.pubkey);
  const [newUserPubkey, setNewUserPubkey] = useState('');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cyan-100">Subscription Settings</h2>

      <section className="bg-gray-800/50 rounded-lg p-4">
        <h3 className="font-medium text-white">Topic Alerts</h3>
        <p className="text-sm text-gray-400 mb-3">Get notified about these hashtags</p>
        <FilterSection
          items={topicSubs.hashtags}
          placeholder="Add hashtag..."
          onAdd={(tag) => void subscribeToTopic(tag)}
          emptyMessage="No topic subscriptions. Add hashtags to get alerts."
        />
      </section>

      <section className="bg-gray-800/50 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-white">User Alerts</h3>
        <p className="text-sm text-gray-400">Get notified when these users post</p>
        <div className="flex gap-2">
          <input
            className="cy-input"
            value={newUserPubkey}
            placeholder="Paste pubkey..."
            onChange={(e) => setNewUserPubkey(e.target.value)}
          />
          <button
            className="cy-btn-secondary"
            onClick={() => {
              if (!newUserPubkey.trim()) return;
              void subscribeToUser(newUserPubkey.trim(), { notifyOnPost: true, notifyOnReply: true, notifyOnZap: true });
              setNewUserPubkey('');
            }}
          >
            Subscribe
          </button>
        </div>
        {userSubs.users.length === 0 ? (
          <p className="text-gray-500 italic">No user subscriptions. Subscribe from profiles.</p>
        ) : (
          <div className="space-y-2">
            {userSubs.users.map((watch) => (
              <div key={watch.pubkey} className="rounded border border-slate-700 p-3 text-sm">
                <p className="cy-mono text-cyan-200 break-all">{watch.pubkey}</p>
                <p className="text-gray-400 mt-1">post: {watch.notifyOnPost ? 'on' : 'off'} · reply: {watch.notifyOnReply ? 'on' : 'off'} · zap: {watch.notifyOnZap ? 'on' : 'off'}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
