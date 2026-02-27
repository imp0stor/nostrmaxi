import { createDraftList, dedupeReplaceableLists, importListJson, listToEventPayload, mergeListVersions, reorderListItems, slugifyListName, type Nip51List } from '../src/lib/nip51Lists';

describe('nip51Lists', () => {
  it('slugifies human readable list names', () => {
    expect(slugifyListName('My Favorite Authors!!!')).toBe('my-favorite-authors');
  });

  it('reorders items deterministically', () => {
    const list = createDraftList({ kind: 30001, ownerPubkey: 'pub', title: 'A' });
    list.items = [
      { id: '1', type: 'p', value: 'a', order: 0 },
      { id: '2', type: 'p', value: 'b', order: 1 },
      { id: '3', type: 'p', value: 'c', order: 2 },
    ];
    const next = reorderListItems(list.items, 2, 0);
    expect(next.map((i) => i.value)).toEqual(['c', 'a', 'b']);
    expect(next.map((i) => i.order)).toEqual([0, 1, 2]);
  });

  it('dedupes replaceable events by pubkey+kind+d using newest event', () => {
    const events: any[] = [
      { id: 'old', pubkey: 'p', kind: 30001, created_at: 10, content: '', sig: 'x', tags: [['d', 'test'], ['title', 'Old']] },
      { id: 'new', pubkey: 'p', kind: 30001, created_at: 20, content: '', sig: 'x', tags: [['d', 'test'], ['title', 'New']] },
    ];
    const lists = dedupeReplaceableLists(events as any);
    expect(lists).toHaveLength(1);
    expect(lists[0].title).toBe('New');
  });

  it('exports a publishable event payload with d and title tags', () => {
    const list = createDraftList({ kind: 30002, ownerPubkey: 'pub', title: 'Relays', dTag: 'relays' });
    const payload = listToEventPayload(list);
    expect(payload.kind).toBe(30002);
    expect(payload.tags.find((t) => t[0] === 'd')?.[1]).toBe('relays');
    expect(payload.tags.find((t) => t[0] === 'title')?.[1]).toBe('Relays');
  });

  it('imports list json and normalizes fields', () => {
    const raw = JSON.stringify({ kind: 30003, title: 'Bookmarks', items: [{ type: 'e', value: 'event1' }] });
    const list = importListJson(raw, 'ownerpub');
    expect(list.ownerPubkey).toBe('ownerpub');
    expect(list.items).toHaveLength(1);
  });

  it('marks conflict when local version is newer than remote', () => {
    const local: Nip51List = { ...createDraftList({ kind: 30001, ownerPubkey: 'a', title: 'L' }), updatedAt: 20, version: 3 };
    const remote: Nip51List = { ...createDraftList({ kind: 30001, ownerPubkey: 'a', title: 'R' }), updatedAt: 10, version: 2, source: 'nostr' };
    const merged = mergeListVersions(local, remote);
    expect(merged.syncState).toBe('conflict');
    expect(merged.title).toBe('L');
  });
});
