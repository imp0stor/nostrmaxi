import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { Subscription, DomainCatalogResponse } from '../types';

interface Nip05Identity {
  address: string;
  localPart: string;
  domain: string;
  createdAt: string;
}

export function Nip05Page() {
  const { refreshUser } = useAuth();
  const [identities, setIdentities] = useState<Nip05Identity[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [domainCatalog, setDomainCatalog] = useState<DomainCatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  
  // Create form state
  const [newLocalPart, setNewLocalPart] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('nostrmaxi.com');
  const [isCreating, setIsCreating] = useState(false);

  // BYOD state
  const [customDomain, setCustomDomain] = useState('');
  const [customDomainStatus, setCustomDomainStatus] = useState<'idle' | 'verifying' | 'verified' | 'needs-verification' | 'error'>('idle');
  const [customDomainMessage, setCustomDomainMessage] = useState<string | null>(null);
  const [customDomainInstructions, setCustomDomainInstructions] = useState<{ name: string; value: string } | null>(null);
  const [useCustomDomain, setUseCustomDomain] = useState(false);

  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailHintCode, setEmailHintCode] = useState<string | null>(null);

  const availableDomains = domainCatalog?.domains?.map((entry) => entry.domain) ?? ['nostrmaxi.com'];

  useEffect(() => {
    Promise.all([
      fetchIdentities(),
      api.getSubscription().then(setSubscription),
      fetchDomainCatalog(),
      api.getEmailStatus().then((status) => { setEmail(status.email || ''); setEmailVerified(status.verified); }),
    ]).finally(() => setIsLoading(false));
  }, []);

  const fetchIdentities = async () => {
    try {
      const response = await fetch('/api/v1/nip05/mine', {
        headers: {
          'Authorization': `Bearer ${api.getToken()}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setIdentities(data);
      }
    } catch (err) {
      console.error('Failed to fetch identities:', err);
    }
  };

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

  const handleRequestEmailCode = async () => {
    try {
      const result = await api.requestEmailVerification(email);
      setEmailHintCode(result.devCode || null);
      setSuccess(`Verification code sent to ${result.email}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    }
  };

  const handleVerifyEmailCode = async () => {
    try {
      await api.verifyEmailCode(email, emailCode);
      setEmailVerified(true);
      setEmailHintCode(null);
      setSuccess('Email verified successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify email code');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocalPart.trim()) return;

    // Check limit
    if (subscription && identities.length >= subscription.nip05Limit) {
      setError(`You've reached your limit of ${subscription.nip05Limit} NIP-05 identities. Upgrade to get more.`);
      return;
    }

    const chosenDomain = useCustomDomain ? customDomain.trim().toLowerCase() : selectedDomain;
    if (useCustomDomain && customDomainStatus !== 'verified') {
      setError('Custom domain is not verified yet. Complete verification before creating this identity.');
      return;
    }
    if (useCustomDomain && !emailVerified) {
      setError('Verify your email before creating custom-domain identities.');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/v1/nip05/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({
          localPart: newLocalPart.toLowerCase(),
          domain: chosenDomain,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create identity');
      }

      const result = await response.json();
      setSuccess(`Successfully created ${result.address}!`);
      setNewLocalPart('');
      await fetchIdentities();
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create identity');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (localPart: string, domain: string) => {
    if (!confirm(`Delete ${localPart}@${domain}? This cannot be undone.`)) return;

    try {
      const response = await fetch('/api/v1/nip05', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ localPart, domain }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete identity');
      }

      setSuccess(`Deleted ${localPart}@${domain}`);
      await fetchIdentities();
      refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete identity');
    }
  };

  const previewDomain = useCustomDomain ? (customDomain.trim().toLowerCase() || 'yourdomain.com') : selectedDomain;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-2">NIP-05 Identities</h1>
      <p className="text-gray-400 mb-8">
        Manage your Nostr verification identities
      </p>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 bg-nostr-dark rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">Email Verification</h2>
        <p className="text-gray-400 text-sm mb-3">Required for subscriptions and custom domains.</p>
        <div className="flex flex-col md:flex-row gap-2 mb-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 px-3 py-2 bg-black/30 border border-gray-700 rounded text-white"
          />
          <button onClick={handleRequestEmailCode} className="px-3 py-2 bg-nostr-purple rounded text-white">Send code</button>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <input
            type="text"
            value={emailCode}
            onChange={(e) => setEmailCode(e.target.value)}
            placeholder="6-digit code"
            className="flex-1 px-3 py-2 bg-black/30 border border-gray-700 rounded text-white"
          />
          <button onClick={handleVerifyEmailCode} className="px-3 py-2 bg-green-600 rounded text-white">Verify</button>
        </div>
        {emailHintCode && <p className="text-xs text-yellow-300 mt-2">Staging code: {emailHintCode}</p>}
        <p className={`text-sm mt-2 ${emailVerified ? 'text-green-400' : 'text-yellow-400'}`}>{emailVerified ? 'Email verified' : 'Email not verified yet'}</p>
      </div>

      {/* Usage indicator */}
      {subscription && (
        <div className="mb-6 bg-nostr-dark rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Identity Usage</span>
            <span className="text-white font-medium">
              {identities.length} / {subscription.nip05Limit}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                identities.length >= subscription.nip05Limit
                  ? 'bg-red-500'
                  : 'bg-nostr-purple'
              }`}
              style={{ width: `${(identities.length / subscription.nip05Limit) * 100}%` }}
            />
          </div>
          {identities.length >= subscription.nip05Limit && (
            <p className="text-yellow-400 text-sm mt-2">
              You've reached your limit. Upgrade for more identities.
            </p>
          )}
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
                  disabled={isCreating || Boolean(subscription && identities.length >= subscription.nip05Limit)}
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
            disabled={!newLocalPart || isCreating || Boolean(subscription && identities.length >= subscription.nip05Limit) || (useCustomDomain && customDomainStatus !== 'verified')}
            className="w-full sm:w-auto px-6 py-3 bg-nostr-purple hover:bg-nostr-purple/80 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Creating...' : 'Claim Identity'}
          </button>
        </form>
      </div>

      {/* Existing identities */}
      <div className="bg-nostr-dark rounded-xl p-6">
        <h2 className="text-xl font-bold text-white mb-4">Your Identities</h2>
        
        {identities.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-gray-400">No identities yet. Claim your first NIP-05 above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {identities.map((identity) => (
              <div
                key={identity.address}
                className="flex items-center justify-between p-4 bg-nostr-darker rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-nostr-purple/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-nostr-purple" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-nostr-purple font-medium">{identity.address}</p>
                    <p className="text-gray-500 text-sm">
                      Created {new Date(identity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(identity.address)}
                    className="p-2 text-gray-400 hover:text-white"
                    title="Copy"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(identity.localPart, identity.domain)}
                    className="p-2 text-red-400 hover:text-red-300"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
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
