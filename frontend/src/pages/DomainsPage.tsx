import { FormEvent, useEffect, useState } from 'react';
import { api } from '../lib/api';

type DomainRecord = {
  id: string;
  domain: string;
  verified: boolean;
  verifyToken?: string;
  lightningName?: string | null;
  site?: {
    template: 'personal' | 'portfolio' | 'blog';
    views: number;
    config: Record<string, unknown>;
  } | null;
};

const templateOptions = ['personal', 'portfolio', 'blog'] as const;

export function DomainsPage() {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [lightningName, setLightningName] = useState('pay');
  const [siteTemplate, setSiteTemplate] = useState<(typeof templateOptions)[number]>('personal');
  const [siteConfig, setSiteConfig] = useState('{\n  "bio": "",\n  "links": []\n}');

  const authHeaders = () => ({
    Authorization: `Bearer ${api.getToken()}`,
    'Content-Type': 'application/json',
  });

  const loadDomains = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/domains', { headers: authHeaders() });
      if (!response.ok) throw new Error('Failed to fetch domains');
      const data = await response.json();
      setDomains(data);
      setSelectedDomainId((current) => current || data?.[0]?.id || '');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch domains');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDomains();
  }, []);

  const handleAddDomain = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const response = await fetch('/api/v1/domains', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ domain: domainInput }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to add domain');
      }
      setMessage(`Domain added. Create TXT record: ${payload.instructions?.value}`);
      setDomainInput('');
      await loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add domain');
    }
  };

  const handleVerify = async (id: string) => {
    setMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/v1/domains/${encodeURIComponent(id)}/verify`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Verification failed');
      setMessage(payload.message || (payload.verified ? 'Domain verified.' : 'Not verified yet.'));
      await loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    }
  };

  const handleSaveLightning = async () => {
    if (!selectedDomainId) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/domains/${encodeURIComponent(selectedDomainId)}/lightning-name`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ lightningName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Failed to set lightning name');
      setMessage(`Lightning address ready: ${payload.lightningName}@${payload.domain}`);
      await loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set lightning name');
    }
  };

  const handleSaveSite = async () => {
    if (!selectedDomainId) return;
    setError(null);
    setMessage(null);

    try {
      const parsedConfig = JSON.parse(siteConfig);
      const response = await fetch(`/api/v1/domains/${encodeURIComponent(selectedDomainId)}/site`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ template: siteTemplate, config: parsedConfig }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message || 'Failed to save site');
      setMessage('Site template saved.');
      await loadDomains();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON config or failed save');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-white">
      <h1 className="text-3xl font-bold mb-2">Domains</h1>
      <p className="text-orange-300/90 mb-6">Bring your own domain for custom Lightning and branded landing pages.</p>

      {error ? <div className="mb-4 p-3 rounded border border-red-500/40 bg-red-900/30 text-red-200">{error}</div> : null}
      {message ? <div className="mb-4 p-3 rounded border border-orange-500/40 bg-black text-orange-200">{message}</div> : null}

      <div className="mb-6 p-4 rounded-xl border border-orange-500/30 bg-black">
        <h2 className="text-lg font-semibold mb-3 text-orange-300">1) Add domain</h2>
        <form onSubmit={handleAddDomain} className="flex gap-3">
          <input
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-3 py-2"
            placeholder="mydomain.com"
          />
          <button className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500">Add</button>
        </form>
        <ol className="mt-3 text-sm text-neutral-300 list-decimal pl-5 space-y-1">
          <li>Create domain.</li>
          <li>Add TXT DNS record: <code>nostrmaxi-verify=&lt;token&gt;</code></li>
          <li>Click Verify to refresh status.</li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading ? <div className="text-neutral-400">Loading domains…</div> : domains.map((d) => (
          <div key={d.id} className="p-4 rounded-xl border border-neutral-800 bg-black">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{d.domain}</p>
                <p className={d.verified ? 'text-green-300 text-sm' : 'text-yellow-300 text-sm'}>
                  {d.verified ? 'Verified' : 'Pending verification'}
                </p>
              </div>
              <button onClick={() => handleVerify(d.id)} className="px-3 py-1 rounded border border-orange-500/60 text-orange-200 hover:bg-orange-500/20">
                Refresh Verify
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-400">TXT value: nostrmaxi-verify={d.verifyToken}</p>
            <button
              onClick={() => setSelectedDomainId(d.id)}
              className="mt-3 text-xs underline text-orange-300"
            >
              Configure Lightning + Site
            </button>
          </div>
        ))}
      </div>

      {selectedDomainId ? (
        <div className="mt-8 p-4 rounded-xl border border-orange-500/35 bg-black">
          <h2 className="text-lg font-semibold mb-3 text-orange-300">2) Lightning + Site</h2>

          <div className="mb-4">
            <label className="block text-sm text-neutral-300 mb-1">Lightning alias name</label>
            <div className="flex gap-3">
              <input value={lightningName} onChange={(e) => setLightningName(e.target.value)} className="bg-neutral-950 border border-neutral-700 rounded px-3 py-2" />
              <button onClick={handleSaveLightning} className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500">Save Alias</button>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-sm text-neutral-300 mb-1">Template</label>
            <select value={siteTemplate} onChange={(e) => setSiteTemplate(e.target.value as any)} className="bg-neutral-950 border border-neutral-700 rounded px-3 py-2">
              {templateOptions.map((template) => <option key={template} value={template}>{template}</option>)}
            </select>
          </div>
          <label className="block text-sm text-neutral-300 mb-1 mt-3">Template config (JSON)</label>
          <textarea value={siteConfig} onChange={(e) => setSiteConfig(e.target.value)} className="w-full min-h-36 bg-neutral-950 border border-neutral-700 rounded px-3 py-2 font-mono text-xs" />
          <button onClick={handleSaveSite} className="mt-3 px-4 py-2 rounded bg-orange-600 hover:bg-orange-500">Save Site</button>
        </div>
      ) : null}

      <div className="mt-8 p-4 rounded-xl border border-neutral-800 bg-black text-sm text-neutral-300">
        <h3 className="font-semibold text-orange-300 mb-2">Analytics</h3>
        <p>Page views are counted when your custom domain hits <code>/api/v1/domain-site</code>. Use <code>GET /api/v1/domains/:id/analytics</code> for totals.</p>
      </div>
    </div>
  );
}
