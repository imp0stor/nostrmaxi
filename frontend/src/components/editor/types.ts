import type { KeyboardEvent } from 'react';

export type ContentType = 'short-form' | 'long-form' | 'media' | 'event' | 'poll';
export type MediaType = 'image' | 'video' | 'audio';
export type EmbedPlatform = 'youtube' | 'vimeo' | 'spotify' | 'twitter' | 'github' | 'generic';
export type Visibility = 'public' | 'unlisted' | 'followers' | 'private';

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  alt?: string;
}

export interface EmbedItem {
  id: string;
  url: string;
  platform: EmbedPlatform;
  title?: string;
}

export interface PollOption { id: string; text: string; votes?: number }

export interface EventDetails {
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  rsvpEnabled?: boolean;
}

export interface PublishSettingsState {
  isDraft: boolean;
  publishNow: boolean;
  scheduledAt?: string;
}

export interface EditorState {
  contentType: ContentType;
  title: string;
  summary: string;
  body: string;
  code: string;
  media: MediaItem[];
  embeds: EmbedItem[];
  hashtags: string[];
  mentions: string[];
  tags: string[];
  categories: string[];
  visibility: Visibility;
  pollOptions: PollOption[];
  pollDurationHours: number;
  event?: EventDetails;
  publishSettings: PublishSettingsState;
  coverImageUrl?: string;
  updatedAt: number;
}

export interface NostrEventDraft {
  kind: 1 | 30023 | 31922 | 6969;
  content: string;
  tags: string[][];
}

export const DEFAULT_EDITOR_STATE: EditorState = {
  contentType: 'short-form',
  title: '',
  summary: '',
  body: '',
  code: '',
  media: [],
  embeds: [],
  hashtags: [],
  mentions: [],
  tags: [],
  categories: [],
  visibility: 'public',
  pollOptions: [
    { id: '1', text: '' },
    { id: '2', text: '' },
  ],
  pollDurationHours: 24,
  event: undefined,
  publishSettings: {
    isDraft: true,
    publishNow: false,
  },
  coverImageUrl: undefined,
  updatedAt: Date.now(),
};

export const onEditorShortcut = (
  event: KeyboardEvent,
  actions: { save: () => void; preview: () => void; undo: () => void; redo: () => void },
): void => {
  const mod = event.ctrlKey || event.metaKey;
  if (!mod) return;
  const key = event.key.toLowerCase();
  if (key === 's') {
    event.preventDefault();
    actions.save();
  } else if (key === 'p') {
    event.preventDefault();
    actions.preview();
  } else if (key === 'z' && !event.shiftKey) {
    event.preventDefault();
    actions.undo();
  } else if ((key === 'z' && event.shiftKey) || key === 'y') {
    event.preventDefault();
    actions.redo();
  }
};
