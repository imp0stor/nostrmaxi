import { useMemo, useState } from 'react';
import { DEFAULT_EDITOR_STATE, type EditorState } from '../types';

const STORAGE_PREFIX = 'nostrmaxi.editor.draft';

export interface EditorHistorySnapshot {
  timestamp: number;
  state: EditorState;
}

export const loadDraft = (key: string): EditorState | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`${STORAGE_PREFIX}.${key}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EditorState;
  } catch {
    return null;
  }
};

export const persistDraft = (key: string, state: EditorState): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${STORAGE_PREFIX}.${key}`, JSON.stringify(state));
};

export const useEditorState = (draftKey: string, initial?: Partial<EditorState>) => {
  const seed = useMemo(() => ({ ...DEFAULT_EDITOR_STATE, ...loadDraft(draftKey), ...initial }), [draftKey, initial]);
  const [present, setPresent] = useState<EditorState>(seed);
  const [past, setPast] = useState<EditorHistorySnapshot[]>([]);
  const [future, setFuture] = useState<EditorHistorySnapshot[]>([]);
  const [versions, setVersions] = useState<EditorHistorySnapshot[]>([{ timestamp: Date.now(), state: seed }]);

  const commit = (next: EditorState) => {
    const timestamp = Date.now();
    const stamped = { ...next, updatedAt: timestamp };
    setPast((entries) => [...entries, { timestamp, state: present }].slice(-100));
    setFuture([]);
    setPresent(stamped);
    setVersions((entries) => [...entries, { timestamp, state: stamped }].slice(-100));
    persistDraft(draftKey, stamped);
  };

  const update = (patch: Partial<EditorState>) => commit({ ...present, ...patch });

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((entries) => entries.slice(0, -1));
    setFuture((entries) => [...entries, { timestamp: Date.now(), state: present }]);
    setPresent(previous.state);
  };

  const redo = () => {
    const next = future[future.length - 1];
    if (!next) return;
    setFuture((entries) => entries.slice(0, -1));
    setPast((entries) => [...entries, { timestamp: Date.now(), state: present }]);
    setPresent(next.state);
  };

  return { state: present, update, undo, redo, versions, saveDraft: () => persistDraft(draftKey, present) };
};
