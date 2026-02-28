import { useState } from 'react';

interface AddNoteModalProps {
  initialValue?: string;
  onSave: (note: string) => Promise<void> | void;
  onClose: () => void;
}

export function AddNoteModal({ initialValue = '', onSave, onClose }: AddNoteModalProps) {
  const [note, setNote] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="cy-card w-full max-w-lg p-5 space-y-4">
        <h3 className="text-lg font-semibold text-cyan-100">Private bookmark note</h3>
        <textarea
          className="w-full min-h-36 cy-input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Write a private note..."
        />
        <div className="flex justify-end gap-2">
          <button className="cy-chip" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="cy-btn"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(note);
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
