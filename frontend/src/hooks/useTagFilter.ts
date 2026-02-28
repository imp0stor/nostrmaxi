import { useEffect, useMemo, useState } from 'react';
import type { FilterLogic } from '../lib/filterLogic';

export interface UseTagFilterOptions {
  storageKey: string;
  defaultLogic?: 'and' | 'or';
  initialTags?: string[];
}

interface PersistedTagFilter {
  selectedTags: string[];
  logic: 'and' | 'or';
}

const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

export function useTagFilter(options: UseTagFilterOptions) {
  const [selectedTags, setSelectedTags] = useState<string[]>(options.initialTags || []);
  const [logic, setLogic] = useState<'and' | 'or'>(options.defaultLogic || 'or');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(options.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as PersistedTagFilter;
      if (Array.isArray(parsed.selectedTags)) {
        setSelectedTags(parsed.selectedTags.map(normalizeTag).filter(Boolean));
      }
      if (parsed.logic === 'and' || parsed.logic === 'or') {
        setLogic(parsed.logic);
      }
    } catch {
      // ignore malformed saved filters
    }
  }, [options.storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedTagFilter = { selectedTags, logic };
    window.localStorage.setItem(options.storageKey, JSON.stringify(payload));
  }, [options.storageKey, selectedTags, logic]);

  const toggleTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    setSelectedTags((prev) => prev.includes(normalized)
      ? prev.filter((value) => value !== normalized)
      : [...prev, normalized]);
  };

  const addCustomTag = (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    setSelectedTags((prev) => prev.includes(normalized) ? prev : [...prev, normalized]);
  };

  const clearTags = () => setSelectedTags([]);

  const logicAsFilterLogic = useMemo<FilterLogic>(() => (logic === 'and' ? 'and' : 'or'), [logic]);

  return {
    selectedTags,
    logic,
    logicAsFilterLogic,
    setSelectedTags,
    setLogic,
    toggleTag,
    addCustomTag,
    clearTags,
  };
}
