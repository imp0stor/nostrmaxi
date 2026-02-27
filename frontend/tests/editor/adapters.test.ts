import { serializeToNostrDraft, deserializeFromNostrDraft, validateEditorState, resolveKind } from '../../../frontend/src/components/editor/adapters/contentTypeAdapters';
import { DEFAULT_EDITOR_STATE } from '../../../frontend/src/components/editor/types';

describe('content type adapters', () => {
  it('maps kinds correctly', () => {
    expect(resolveKind('short-form')).toBe(1);
    expect(resolveKind('long-form')).toBe(30023);
    expect(resolveKind('event')).toBe(31922);
    expect(resolveKind('poll')).toBe(6969);
  });

  it('serializes and deserializes drafts', () => {
    const draft = serializeToNostrDraft({
      ...DEFAULT_EDITOR_STATE,
      contentType: 'long-form',
      title: 'My title',
      body: 'Hello',
      tags: ['nostr'],
    });
    expect(draft.kind).toBe(30023);
    const parsed = deserializeFromNostrDraft(draft);
    expect(parsed.contentType).toBe('long-form');
    expect(parsed.tags).toContain('nostr');
  });

  it('validates required fields', () => {
    const errors = validateEditorState({ ...DEFAULT_EDITOR_STATE, contentType: 'long-form', body: '', title: '' });
    expect(errors).toContain('Long-form content requires a title.');
  });
});
