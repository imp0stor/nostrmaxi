import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { Subscription, DomainCatalogResponse } from '../types';
import { useIdentityStore } from '../stores/identityStore';
import { requestIdentityRefresh } from '../lib/identityRefresh';

export function Nip05Page() {
  const { refreshUser } = useAuth();
  const {
    identities,
    isLoadingManaged,
    isLoadingExternal,
    isCreating,
    error,
    success,
    loadIdentities,
    createIdentity,
    deleteIdentity,
    clearMessages,
  } = useIdentityStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [domainCatalog, setDomainCatalog] = useState<DomainCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Create form state
  const [newLocalPart, setNewLocalPart] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('nostrmaxi.com');

  // BYOD state
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainStatus, setCustomDomainStatus] = useState<'idle' | 'verifying' | 'verified' | 'needs-verification' | 'error'>('idle');
  const [customDomainMessage, setCustomDomainMessage] = useState<string | null>(null);
  const [customDomainInstructions, setCustomDomainInstructions] = useState<{ name: string; value: string } | null>(null);
  const [useCustomDomain, setUseCustomDomain] = useState(false);

  const availableDomains = domainCatalog?.domains?.map((entry) => entry.domain) ?? ['nostrmaxi.com'];

  useEffect(() => {
    Promise.all([
      loadIdentities(),
      api.getSubscription().then(setSubscription),
      fetchDomainCatalog(),
    ]).finally(() => {
      requestIdentityRefresh();
    });
  }, [loadIdentities]);

  const fetchDomainCatalog = async () => {
    try {
      const response = await fetch('/api/v1/nip05/domains');
      if (!response.ok) {
        throw new Error('Failed to load domain catalog');
      }
      const data: DomainCatalogResponse = await response.json();
      setDomainCatalog(data);
      setCatalogError(null);
      if (data?.defaultDomain) {
        setSelectedDomain(data.defaultDomain);
      } else if (data?.domains?.length) {
        setSelectedDomain(data.domains[0].domain);
      }
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Failed to load domain catalog');
    }
  };

  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

  const handleVerifyDomain = async () => {
    const trimmed = customDomain.trim().toLowerCase();
    if (!trimmed) {
      setCustomDomainStatus('error');
      setCustomDomainMessage('Enter a domain to verify.');
      return;
    }
    if (!domainRegex.test(trimmed)) {
      setCustomDomainStatus('error');
      setCustomDomainMessage('Use a valid domain like example.com.');
      return;
    }

    setCustomDomainStatus('verifying');
    setCustomDomainMessage(null);
    setCustomDomainInstructions(null);

    try {
      const response = await fetch(`/api/v1/nip05/verify/${encodeURIComponent(trimmed)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to verify domain');
      }

      const data = await response.json();
      if (data.verified) {
        setCustomDomainStatus('verified');
        setCustomDomainMessage('Domain verified and ready to use.');
        setUseCustomDomain(true);
      } else {
        setCustomDomainStatus('needs-verification');
        setCustomDomainMessage('Add the TXT record below, then click Verify again.');
        if (data.instructions?.name && data.instructions?.value) {
          setCustomDomainInstructions({ name: data.instructions.name, value: data.instructions.value });
        }
      }
    } catch (err) {
      setCustomDomainStatus('error');
      setCustomDomainMessage(err instanceof Error ? err.message : 'Failed to verify domain');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocalPart.trim()) return;

    if (!isPaidTier) {
      return;
    }

    // Check limit
    if (isAtSingleUserLimit) {
      return;
    }

    const chosenDomain = useCustomDomain ? customDomain.trim().toLowerCase() : selectedDomain;
    if (useCustomDomain && customDomainStatus !== 'verified') {
      return;
    }

    const created = await createIdentity(newLocalPart.toLowerCase(), chosenDomain);
    if (created) {
      setNewLocalPart('');
      refreshUser();
    }
  };

  const handleDelete = async (localPart: string, domain: string) => {
    if (!confirm(`Delete ${localPart}@${domain}? This cannot be undone.`)) return;

    const deleted = await deleteIdentity(localPart, domain);
    if (deleted) {
      refreshUser();
    }
  };

  const previewDomain = useCustomDomain ? (customDomain.trim().toLowerCase() || 'yourdomain.com') : selectedDomain;
  const isPaidTier = Boolean(subscription && subscription.tier !== 'FREE' && subscription.isActive);
  const managedIdentities = identities.filter((identity) => identity.source === 'managed');
  const externalIdentities = identities.filter((identity) => identity.source === 'external');
  const hasVerifiedExternal = externalIdentities.some((identity) => identity.verified);
  const singleUserLimit = Math.max(1, Math.min(subscription?.nip05Limit ?? 1, 1));
  const isAtSingleUserLimit = managedIdentities.length >= singleUserLimit;
  const isInitialLoading = isLoadingManaged && isLoadingExternal && identities.length === 0;

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">Your NIP-05 Identity</h1>
      <p className="text-gray-400 mb-8">
        Manage one verified Nostr identity address.
      </p>

      {externalIdentities.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-blue-500/40 bg-blue-500/10">
          <p className="text-blue-200 font-medium">External NIP-05 detected on your profile.</p>
          <p className="text-sm text-blue-100/90 mt-1">
            {hasVerifiedExternal
              ? 'Your existing external NIP-05 is active and recognized. Managed NIP-05 + Lightning is optional.'
              : 'We found an external NIP-05. You can keep using it, or optionally upgrade for managed identity + Lightning tools.'}
          </p>
          <div className="mt-3">
            <Link to="/pricing" className="inline-flex px-4 py-2 rounded-lg bg-blue-600/70 hover:bg-blue-600 text-white text-sm font-medium">
              Get NIP-05 + Lightning Address
            </Link>
          </div>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          {error}
          <button onClick={clearMessages} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
          {success}
          <button onClick={clearMessages} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Usage indicator */}
      {subscription && (
        <div className="mb-6 bg-nostr-dark rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Identity Usage</span>
            <span className="text-white font-medium">
              {managedIdentities.length} / {singleUserLimit}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                isAtSingleUserLimit
                  ? 'bg-red-500'
                  : 'bg-nostr-purple'
              }`}
              style={{ width: `${(managedIdentities.length / singleUserLimit) * 100}%` }}
            />
          </div>
          {!isPaidTier ? (
            <p className="text-yellow-400 text-sm mt-2">
              NIP-05 is a paid feature. Choose monthly, annual, or lifetime to claim your identity.
            </p>
          ) : isAtSingleUserLimit ? (
            <p className="text-yellow-400 text-sm mt-2">
              This checkout is focused on one managed identity per account.
            </p>
          ) : null}
        </div>
      )}

      {/* Create new identity */}
      <div className="bg-nostr-dark rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-4">Claim New Identity</h2>
        
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Username
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={newLocalPart}
                  onChange={(e) => setNewLocalPart(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="yourname"
                  className="flex-1 px-4 py-3 bg-nostr-darker border border-gray-700 rounded-l-lg text-white focus:border-nostr-purple focus:outline-none"
                  maxLength={64}
                  disabled={!isPaidTier || isCreating || isAtSingleUserLimit}
                />
                <span className="px-4 py-3 bg-gray-800 border border-l-0 border-gray-700 rounded-r-lg text-gray-400">
                  @{previewDomain}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">
                Only lowercase letters, numbers, underscores, and hyphens
              </p>
            </div>
          </div>

          {/* Domain options */}
          <div className="space-y-4">
            <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">Included domains</p>
                  <p className="text-xs text-gray-500">Default domains managed by NostrMaxi + Strange Signal.</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input
                    type="radio"
                    name="domainMode"
                    checked={!useCustomDomain}
                    onChange={() => setUseCustomDomain(false)}
                  />
                  Use included
                </label>
              </div>
              <select
                value={selectedDomain}
                onChange={(e) => setSelectedDomain(e.target.value)}
                className="w-full px-4 py-3 bg-nostr-darker border border-gray-700 rounded-lg text-white"
                disabled={useCustomDomain}
              >
                {(domainCatalog?.domains || availableDomains.map((domain) => ({ domain }))).map((entry: { domain: string; label?: string }) => (
                  <option key={entry.domain} value={entry.domain}>
                    {entry.label ? `${entry.domain} — ${entry.label}` : entry.domain}
                  </option>
                ))}
              </select>
              {catalogError && (
                <p className="text-yellow-400 text-xs mt-2">{catalogError}</p>
              )}
            </div>

            {subscription?.tierInfo.customDomain ? (
              <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">Bring your own domain</p>
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">Advanced</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                      type="radio"
                      name="domainMode"
                      checked={useCustomDomain}
                      onChange={() => setUseCustomDomain(true)}
                    />
                    Use custom
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Verify a domain you control with DNS before we can issue identities on it.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => {
                      setCustomDomain(e.target.value.toLowerCase());
                      setCustomDomainStatus('idle');
                      setCustomDomainMessage(null);
                      setCustomDomainInstructions(null);
                    }}
                    placeholder="yourdomain.com"
                    className="flex-1 px-4 py-3 bg-nostr-dark border border-gray-700 rounded-lg text-white focus:border-nostr-purple focus:outline-none"
                    disabled={!useCustomDomain}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyDomain}
                    disabled={!useCustomDomain || customDomainStatus === 'verifying'}
                    className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {customDomainStatus === 'verifying' ? 'Verifying...' : 'Verify domain'}
                  </button>
                </div>
                {customDomainMessage && (
                  <p className={`text-xs mt-2 ${customDomainStatus === 'verified' ? 'text-green-400' : customDomainStatus === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {customDomainMessage}
                  </p>
                )}
                {customDomainInstructions && (
                  <div className="mt-3 text-xs text-gray-400">
                    <p className="font-semibold text-white">Validation guidance</p>
                    <ul className="mt-2 space-y-1">
                      <li>1. Add a TXT record to your DNS provider.</li>
                      <li>2. Wait 5-10 minutes for propagation.</li>
                      <li>3. Click Verify domain to confirm ownership.</li>
                    </ul>
                    <div className="mt-3 rounded-lg bg-black/30 p-3">
                      <p><span className="text-gray-500">Name:</span> {customDomainInstructions.name}</p>
                      <p><span className="text-gray-500">Value:</span> {customDomainInstructions.value}</p>
                    </div>
                  </div>
                )}
                {!customDomainInstructions && customDomainStatus !== 'verified' && (
                  <p className="text-xs text-gray-500 mt-3">
                    We will provide the TXT record after you click Verify domain.
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800 opacity-70">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-semibold text-white">Bring your own domain</p>
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300">Advanced</span>
                </div>
                <p className="text-sm text-gray-400">
                  Upgrade to Pro or Business to unlock custom domains and advanced verification.
                </p>
              </div>
            )}
          </div>

          {/* Preview */}
          {newLocalPart && (
            <div className="p-4 bg-nostr-darker rounded-lg">
              <p className="text-gray-400 text-sm">Preview</p>
              <p className="text-nostr-purple text-lg font-medium">
                {newLocalPart}@{previewDomain}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!isPaidTier || !newLocalPart || isCreating || isAtSingleUserLimit || (useCustomDomain && customDomainStatus !== 'verified')}
            className="w-full sm:w-auto px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!isPaidTier ? 'Upgrade to claim NIP-05' : isAtSingleUserLimit ? 'Identity already active' : isCreating ? 'Creating...' : 'Claim Identity'}
          </button>
        </form>
      </div>

      {/* Existing identities */}
      <div className="bg-nostr-dark rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-2">Your Identity Status</h2>
        <p className="text-sm text-gray-400 mb-4">NostrMaxi is optimized for one managed identity. External identities from your kind:0 profile are shown read-only.</p>

        <div className="mb-4 text-xs text-gray-500 flex gap-4">
          <span>Managed: {managedIdentities.length}</span>
          <span>External: {externalIdentities.length}</span>
        </div>

        {identities.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-gray-300 mb-1">No managed or external identities found.</p>
            <p className="text-gray-500 text-sm">Add a NIP-05 above, or add one in your Nostr client profile to see it here as external.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">Managed by NostrMaxi</h3>
              {managedIdentities.length === 0 ? (
                <p className="text-gray-500 text-sm">No managed identities yet.</p>
              ) : (
                <div className="space-y-3">
                  {managedIdentities.map((identity) => (
                    <div key={identity.address} className="flex items-center justify-between p-4 bg-nostr-darker rounded-lg border border-purple-500/20">
                      <div>
                        <p className="text-nostr-purple font-medium">{identity.address}</p>
                        <p className="text-gray-500 text-sm">{identity.verificationMessage}</p>
                        <p className="text-xs text-gray-500">{identity.createdAt ? `Created ${new Date(identity.createdAt).toLocaleDateString()}` : 'Managed identity'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${identity.verified ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{identity.verified ? 'Verified' : 'Verification failed'}</span>
                        <button onClick={() => navigator.clipboard.writeText(identity.address)} className="p-2 text-gray-400 hover:text-white" title="Copy">Copy</button>
                        <button onClick={() => handleDelete(identity.localPart, identity.domain)} className="p-2 text-red-400 hover:text-red-300" title="Delete">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-3">External (from your profile)</h3>
              {isLoadingExternal ? (
                <p className="text-gray-500 text-sm">Loading external identity from relays…</p>
              ) : externalIdentities.length === 0 ? (
                <p className="text-gray-500 text-sm">No external NIP-05 found in your kind:0 metadata.</p>
              ) : (
                <div className="space-y-3">
                  {externalIdentities.map((identity) => (
                    <div key={identity.address} className="flex items-center justify-between p-4 bg-nostr-darker rounded-lg border border-blue-500/20">
                      <div>
                        <p className="text-blue-300 font-medium">{identity.address}</p>
                        <p className="text-gray-500 text-sm">{identity.verificationMessage}</p>
                        <p className="text-xs text-gray-500">Not managed here (read-only)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${identity.verified ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{identity.verified ? 'Verified on domain' : 'Verification failed'}</span>
                        <button onClick={() => navigator.clipboard.writeText(identity.address)} className="p-2 text-gray-400 hover:text-white" title="Copy">Copy</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!isPaidTier && (
          <div className="mt-6 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
            Upgrade to a paid tier to add managed NIP-05 identities from NostrMaxi.
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="mt-8 bg-nostr-dark rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-3">How to use your NIP-05</h3>
        <ol className="space-y-3 text-gray-400">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center text-nostr-purple text-sm font-bold">1</span>
            <span>Copy your NIP-05 address (e.g., yourname@nostrmaxi.com)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center text-nostr-purple text-sm font-bold">2</span>
            <span>Open your Nostr client's profile settings</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center text-nostr-purple text-sm font-bold">3</span>
            <span>Paste your NIP-05 into the "NIP-05 Address" field</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-nostr-purple/20 rounded-full flex items-center justify-center text-nostr-purple text-sm font-bold">4</span>
            <span>Save - you'll see a verification checkmark on your profile!</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
