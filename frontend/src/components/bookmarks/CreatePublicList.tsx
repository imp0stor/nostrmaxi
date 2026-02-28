import { useState } from 'react';

interface CreatePublicListProps {
  onCreate: (payload: { id: string; title: string; description?: string }) => Promise<void> | void;
}

export function CreatePublicList({ onCreate }: CreatePublicListProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="cy-card p-4 space-y-3">
      <h3 className="text-cyan-100 font-semibold">Create Public List</h3>
      <input className="cy-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Best Bitcoin Articles" />
      <textarea className="cy-input w-full min-h-20" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="My curated collection..." />
      <button
        className="cy-btn"
        onClick={async () => {
          const normalizedTitle = title.trim();
          if (!normalizedTitle) return;
          const id = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 64);
          await onCreate({ id: id || `list-${Date.now().toString(36)}`, title: normalizedTitle, description: description.trim() || undefined });
          setTitle('');
          setDescription('');
        }}
      >
        Create List
      </button>
    </div>
  );
}
