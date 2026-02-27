import { loadDraft, persistDraft } from '../../../frontend/src/components/editor/state/useEditorState';
import { DEFAULT_EDITOR_STATE } from '../../../frontend/src/components/editor/types';

describe('editor draft persistence', () => {
  const key = 'unit-test';

  beforeEach(() => {
    const store = new Map<string, string>();
    // @ts-expect-error test shim
    global.window = {};
    // @ts-expect-error test shim
    global.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
  });

  it('persists and loads drafts', () => {
    persistDraft(key, { ...DEFAULT_EDITOR_STATE, body: 'hello world' });
    const loaded = loadDraft(key);
    expect(loaded?.body).toBe('hello world');
  });
});
