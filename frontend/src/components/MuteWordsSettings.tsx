import { useMemo, useState } from 'react';
import type { MuteMatchMode, MuteScope, MuteSettings } from '../lib/muteWords';
import { exportMuteSettings, importMuteSettings, removeMuteRule, upsertMuteRule } from '../lib/muteWords';

interface Props {
  settings: MuteSettings;
  onChange: (next: MuteSettings) => void;
  onSync?: () => Promise<void>;
}

const SCOPES: MuteScope[] = ['content', 'hashtags', 'urls', 'displayNames'];
const MODES: MuteMatchMode[] = ['substring', 'whole-word', 'regex'];

export function MuteWordsSettings({ settings, onChange, onSync }: Props) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<MuteMatchMode>('substring');
  const [scopes, setScopes] = useState<MuteScope[]>(['content']);
  const [durationHours, setDurationHours] = useState<string>('');

  const activeCount = useMemo(() => settings.rules.filter((r) => !r.expiresAt || r.expiresAt > Math.floor(Date.now() / 1000)).length, [settings.rules]);

  const addRule = () => {
    if (!value.trim()) return;
    const expiresAt = durationHours ? Math.floor(Date.now() / 1000) + (Number(durationHours) * 3600) : undefined;
    onChange(upsertMuteRule(settings, {
      value: value.trim(),
      mode,
      scopes,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
      caseSensitive: false,
    }));
    setValue('');
    setDurationHours('');
  };

  const toggleScope = (scope: MuteScope) => {
    setScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const onExport = async () => {
    const content = exportMuteSettings(settings);
    await navigator.clipboard.writeText(content);
    alert('Mute list copied to clipboard');
  };

  const onImport = () => {
    const raw = prompt('Paste mute list JSON:');
    if (!raw) return;
    try {
      onChange(importMuteSettings(raw, settings));
    } catch {
      alert('Invalid JSON payload');
    }
  };

  return (
    <section className="cy-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="cy-kicker">MUTE WORDS</p>
          <p className="text-xs text-cyan-400">{activeCount} active rules</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-cyan-100">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => onChange({ ...settings, enabled: e.target.checked })} /> Enabled
        </label>
      </div>

      <div className="grid md:grid-cols-5 gap-2">
        <input className="cy-input md:col-span-2" placeholder="word / phrase / regex" value={value} onChange={(e) => setValue(e.target.value)} />
        <select className="cy-input" value={mode} onChange={(e) => setMode(e.target.value as MuteMatchMode)}>
          {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input className="cy-input" placeholder="duration (hours, blank=forever)" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} />
        <button className="cy-btn" onClick={addRule}>Add</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((scope) => (
          <button key={scope} className={`cy-chip text-xs ${scopes.includes(scope) ? 'border-cyan-300 text-cyan-100' : ''}`} onClick={() => toggleScope(scope)}>
            {scope}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.strictReplies} onChange={(e) => onChange({ ...settings, strictReplies: e.target.checked })} /> Strict replies</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={settings.strictQuotes} onChange={(e) => onChange({ ...settings, strictQuotes: e.target.checked })} /> Strict quotes</label>
        <select className="cy-input max-w-[220px]" value={settings.privacyMode} onChange={(e) => onChange({ ...settings, privacyMode: e.target.value as MuteSettings['privacyMode'] })}>
          <option value="local">Local only</option>
          <option value="public">Publish plaintext (kind 10000)</option>
          <option value="encrypted">Publish encrypted (kind 10000 + NIP-04)</option>
        </select>
        {onSync ? <button className="cy-btn-secondary text-xs" onClick={() => void onSync()}>Sync now</button> : null}
        <button className="cy-btn-secondary text-xs" onClick={() => void onExport()}>Export</button>
        <button className="cy-btn-secondary text-xs" onClick={onImport}>Import</button>
      </div>

      <div className="space-y-2">
        {settings.rules.map((rule) => (
          <div key={rule.id} className="cy-chip flex items-center justify-between gap-2">
            <span className="text-xs">{rule.value} · {rule.mode} · {rule.scopes.join(',')}</span>
            <button className="text-red-300 text-xs" onClick={() => onChange(removeMuteRule(settings, rule.id))}>Remove</button>
          </div>
        ))}
        {settings.rules.length === 0 ? <p className="text-xs text-cyan-400">No mute rules yet.</p> : null}
      </div>
    </section>
  );
}
