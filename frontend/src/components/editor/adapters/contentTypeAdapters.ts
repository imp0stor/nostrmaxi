import type { EditorState, NostrEventDraft } from '../types';

export const resolveKind = (type: EditorState['contentType']): NostrEventDraft['kind'] => {
  if (type === 'long-form') return 30023;
  if (type === 'event') return 31922;
  if (type === 'poll') return 6969;
  return 1;
};

export const serializeToNostrDraft = (state: EditorState): NostrEventDraft => {
  const tags: string[][] = [
    ...state.tags.map((tag) => ['t', tag]),
    ...state.hashtags.map((tag) => ['t', tag.replace(/^#/, '')]),
    ...state.mentions.map((mention) => ['p', mention]),
    ...state.categories.map((category) => ['category', category]),
    ...state.media.map((media) => ['media', media.type, media.url]),
    ...state.embeds.map((embed) => ['r', embed.url, embed.platform]),
    ['visibility', state.visibility],
  ];

  if (state.coverImageUrl) tags.push(['image', state.coverImageUrl]);
  if (state.publishSettings.scheduledAt) tags.push(['publish_at', state.publishSettings.scheduledAt]);

  if (state.contentType === 'poll') {
    state.pollOptions.forEach((option) => tags.push(['poll_option', option.text]));
    tags.push(['poll_duration', String(state.pollDurationHours)]);
  }

  if (state.contentType === 'event' && state.event) {
    tags.push(['title', state.event.title]);
    tags.push(['start', state.event.startAt]);
    if (state.event.endAt) tags.push(['end', state.event.endAt]);
    if (state.event.location) tags.push(['location', state.event.location]);
    tags.push(['rsvp', state.event.rsvpEnabled ? 'true' : 'false']);
  }

  const contentParts = [state.body, state.summary, state.code].filter(Boolean);
  return { kind: resolveKind(state.contentType), content: contentParts.join('\n\n'), tags };
};

export const deserializeFromNostrDraft = (draft: NostrEventDraft): Partial<EditorState> => {
  const tagValues = (key: string): string[] => draft.tags.filter(([k]) => k === key).map(([, value]) => value || '');
  return {
    contentType: draft.kind === 30023 ? 'long-form' : draft.kind === 31922 ? 'event' : draft.kind === 6969 ? 'poll' : 'short-form',
    body: draft.content,
    tags: tagValues('t'),
    mentions: tagValues('p'),
    categories: tagValues('category'),
    visibility: (tagValues('visibility')[0] as EditorState['visibility']) || 'public',
    coverImageUrl: tagValues('image')[0],
  };
};

export const validateEditorState = (state: EditorState): string[] => {
  const errors: string[] = [];
  if (!state.body && !state.media.length && !state.embeds.length && state.contentType !== 'event' && state.contentType !== 'poll') {
    errors.push('Post content is required.');
  }
  if (state.contentType === 'long-form' && !state.title.trim()) errors.push('Long-form content requires a title.');
  if (state.contentType === 'poll') {
    const validOptions = state.pollOptions.filter((option) => option.text.trim().length > 0);
    if (validOptions.length < 2) errors.push('Polls require at least two options.');
  }
  if (state.contentType === 'event') {
    if (!state.event?.title) errors.push('Events require a title.');
    if (!state.event?.startAt) errors.push('Events require a start time.');
  }
  return errors;
};
