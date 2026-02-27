import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { publishEvent, signEvent } from '../lib/nostr';
import {
  LIST_KIND_META,
  LIST_TEMPLATES,
  buildListShareUrl,
  createDraftList,
  discoverPublicNip51Lists,
  exportListJson,
  importListJson,
  listToEventPayload,
  loadMyNip51Lists,
  reorderListItems,
  slugifyListName,
  type ListItem,
  type Nip51List,
  type Nip51ListKind,
} from '../lib/nip51Lists';

export function ListsPage() {
  const { user } = useAuth();
  const [lists, setLists] = useState<Nip51List[]>([]);
  const [discover, setDiscover] = useState<Nip51List[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [dTag, setDTag] = useState('');
  const [kind, setKind] = useState<Nip51ListKind>(30001);
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState<ListItem['type']>('p');
  const [itemValue, setItemValue] = useState('');

  const selected = useMemo(() => lists.find((list) => `${list.ownerPubkey}:${list.kind}:${list.dTag}` === selectedId) || null, [lists, selectedId]);

  const refresh = async () => {
    if (!user?.pubkey) return;
    setLoading(true);
    const [mine, publicLists] = await Promise.all([
      loadMyNip51Lists(user.pubkey),
      discoverPublicNip51Lists(),
    ]);
    setLists(mine);
    setDiscover(publicLists.filter((list) => list.ownerPubkey !== user.pubkey));
    if (!selectedId && mine[0]) setSelectedId(`${mine[0].ownerPubkey}:${mine[0].kind}:${mine[0].dTag}`);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [user?.pubkey]);

  useEffect(() => {
    setDTag(slugifyListName(title));
  }, [title]);

  const createList = () => {
    if (!user?.pubkey || !title.trim()) return;
    const draft = createDraftList({ kind, title, dTag, ownerPubkey: user.pubkey, description });
    setLists((prev) => [draft, ...prev]);
    setSelectedId(`${draft.ownerPubkey}:${draft.kind}:${draft.dTag}`);
    setShowCreate(false);
    setTitle('');
    setDescription('');
  };

  const updateSelected = (updater: (list: Nip51List) => Nip51List) => {
    if (!selected) return;
    setLists((prev) => prev.map((list) => `${list.ownerPubkey}:${list.kind}:${list.dTag}` === selectedId ? updater(list) : list));
  };

  const addItem = () => {
    if (!selected || !itemValue.trim()) return;
    const nextItem: ListItem = {
      id: `${itemType}:${itemValue.trim()}:${selected.items.length}`,
      type: itemType,
      value: itemValue.trim(),
      order: selected.items.length,
    };
    updateSelected((list) => ({ ...list, items: [...list.items, nextItem], updatedAt: Math.floor(Date.now() / 1000), version: list.version + 1, syncState: 'idle' }));
    setItemValue('');
  };

  const removeItem = (id: string) => {
    updateSelected((list) => ({ ...list, items: list.items.filter((item) => item.id !== id).map((item, idx) => ({ ...item, order: idx })), version: list.version + 1, syncState: 'idle' }));
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    updateSelected((list) => ({ ...list, items: reorderListItems(list.items, fromIndex, toIndex), version: list.version + 1, syncState: 'idle' }));
  };

  const saveToNostr = async () => {
    if (!selected || !user?.pubkey) return;
    setSaving(true);
    updateSelected((list) => ({ ...list, syncState: 'syncing' }));
    try {
      const signed = await signEvent(listToEventPayload(selected));
      if (!signed) throw new Error('sign failed');
      const result = await publishEvent(signed);
      if (!result?.success) throw new Error('publish failed');
      updateSelected((list) => ({ ...list, eventId: signed.id, syncState: 'synced', updatedAt: signed.created_at, source: 'nostr' }));
      alert('List saved to relays');
    } catch {
      updateSelected((list) => ({ ...list, syncState: 'error' }));
      alert('Failed to publish list');
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = LIST_TEMPLATES.find((t) => t.id === templateId);
    if (!template || !selected) return;
    updateSelected((list) => ({
      ...list,
      kind: template.kind,
      items: template.suggestedItems.map((item, index) => ({ id: `${item.type}:${item.value}:${index}`, type: item.type, value: item.value, order: index })),
      title: list.title || template.label,
      description: list.description || template.description,
      version: list.version + 1,
    }));
  };

  if (!user?.pubkey) return <div className="max-w-5xl mx-auto px-4 py-8"><div className="cy-card p-5">Login required.</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-[340px,1fr] gap-6">
      <section className="cy-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="cy-kicker">NIP-51 LISTS</p>
            <h1 className="cy-title text-xl">Dashboard</h1>
          </div>
          <button className="cy-btn-secondary text-xs" onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Close' : 'Create list'}</button>
        </div>

        {showCreate ? (
          <div className="space-y-2">
            <input className="cy-input" placeholder="List title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="cy-input" placeholder="d-tag slug" value={dTag} onChange={(e) => setDTag(slugifyListName(e.target.value))} />
            <select className="cy-input" value={kind} onChange={(e) => setKind(Number(e.target.value) as Nip51ListKind)}>
              {(Object.keys(LIST_KIND_META) as unknown as Nip51ListKind[]).map((k) => <option key={k} value={k}>{k} · {LIST_KIND_META[k].label}</option>)}
            </select>
            <textarea className="cy-input" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button className="cy-btn w-full" onClick={createList}>Create</button>
          </div>
        ) : null}

        {loading ? <p className="text-sm text-cyan-200">Loading lists…</p> : null}
        <div className="space-y-2 max-h-[62vh] overflow-auto pr-1">
          {lists.map((list) => {
            const id = `${list.ownerPubkey}:${list.kind}:${list.dTag}`;
            const active = id === selectedId;
            return (
              <button key={id} onClick={() => setSelectedId(id)} className={`w-full text-left rounded-lg border p-3 ${active ? 'border-cyan-400 bg-cyan-900/20' : 'border-cyan-700/30'}`}>
                <p className="text-sm text-cyan-100 font-semibold truncate">{list.title}</p>
                <p className="text-[11px] text-cyan-300">{LIST_KIND_META[list.kind].label} · {list.items.length} items</p>
                <p className="text-[10px] text-slate-400">{list.dTag} · v{list.version} · {list.syncState}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        {selected ? (
          <>
            <div className="cy-card p-4 space-y-3">
              <div className="flex justify-between gap-3 flex-wrap">
                <div>
                  <p className="cy-kicker">List editor</p>
                  <h2 className="cy-title text-xl">{selected.title}</h2>
                  <p className="text-xs text-cyan-300">{selected.kind} · {LIST_KIND_META[selected.kind].label}</p>
                </div>
                <div className="flex gap-2">
                  <button className="cy-btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(buildListShareUrl(selected.ownerPubkey, selected.dTag))}>Share</button>
                  <button className="cy-btn-secondary text-xs" onClick={() => navigator.clipboard.writeText(exportListJson(selected))}>Export</button>
                  <button className="cy-btn-secondary text-xs" onClick={() => {
                    const raw = prompt('Paste list JSON');
                    if (!raw) return;
                    try {
                      const imported = importListJson(raw, user.pubkey);
                      setLists((prev) => [imported, ...prev]);
                    } catch {
                      alert('Invalid JSON');
                    }
                  }}>Import</button>
                  <button className="cy-btn text-xs" disabled={saving} onClick={() => void saveToNostr()}>{saving ? 'Saving…' : 'Sync to Nostr'}</button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-2">
                <input className="cy-input" value={selected.title} onChange={(e) => updateSelected((list) => ({ ...list, title: e.target.value, version: list.version + 1 }))} />
                <input className="cy-input" value={selected.dTag} onChange={(e) => updateSelected((list) => ({ ...list, dTag: slugifyListName(e.target.value), version: list.version + 1 }))} />
                <select className="cy-input" value={selected.kind} onChange={(e) => updateSelected((list) => ({ ...list, kind: Number(e.target.value) as Nip51ListKind, version: list.version + 1 }))}>
                  {(Object.keys(LIST_KIND_META) as unknown as Nip51ListKind[]).map((k) => <option key={k} value={k}>{k} · {LIST_KIND_META[k].label}</option>)}
                </select>
                <select className="cy-input" value="" onChange={(e) => { if (e.target.value) applyTemplate(e.target.value); }}>
                  <option value="">Apply template…</option>
                  {LIST_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="cy-card p-4 space-y-3">
              <p className="cy-kicker">Items</p>
              <div className="grid md:grid-cols-[120px,1fr,auto] gap-2">
                <select className="cy-input" value={itemType} onChange={(e) => setItemType(e.target.value as ListItem['type'])}>
                  <option value="p">p (profile)</option>
                  <option value="e">e (event)</option>
                  <option value="a">a (address)</option>
                  <option value="r">r (relay)</option>
                  <option value="t">t (topic)</option>
                </select>
                <input className="cy-input" placeholder="value" value={itemValue} onChange={(e) => setItemValue(e.target.value)} />
                <button className="cy-btn" onClick={addItem}>Add</button>
              </div>
              <div className="space-y-2">
                {selected.items.map((item, index) => (
                  <div key={item.id} className="rounded border border-cyan-700/40 p-2 flex justify-between gap-2 items-center" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData('text/plain'));
                    moveItem(from, index);
                  }}>
                    <p className="text-xs text-cyan-100">{index + 1}. [{item.type}] {item.value}</p>
                    <div className="flex gap-2">
                      <button className="cy-chip text-xs" onClick={() => moveItem(index, Math.max(0, index - 1))}>↑</button>
                      <button className="cy-chip text-xs" onClick={() => moveItem(index, Math.min(selected.items.length - 1, index + 1))}>↓</button>
                      <button className="cy-chip text-xs text-red-300" onClick={() => removeItem(item.id)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : <div className="cy-card p-4">Select or create a list.</div>}

        <div className="cy-card p-4">
          <p className="cy-kicker">Public list discovery</p>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            {discover.slice(0, 12).map((list) => {
              const key = `${list.ownerPubkey}:${list.kind}:${list.dTag}`;
              return (
                <article key={key} className="rounded-lg border border-cyan-700/30 p-3">
                  <p className="text-sm font-semibold text-cyan-100">{list.title}</p>
                  <p className="text-xs text-cyan-300">{LIST_KIND_META[list.kind].label} · {list.items.length} items</p>
                  <button className="cy-chip text-xs mt-2" onClick={() => {
                    const followed: Nip51List = { ...list, ownerPubkey: user.pubkey, source: 'imported', syncState: 'idle', version: 1, dTag: `${list.dTag}-followed` };
                    setLists((prev) => [followed, ...prev]);
                  }}>
                    Follow / Clone
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
