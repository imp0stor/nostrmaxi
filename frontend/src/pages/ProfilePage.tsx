import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { truncateNpub } from '../lib/nostr';

interface ProfileForm {
  bio: string;
  avatar: string;
  banner: string;
  website: string;
  twitter: string;
  github: string;
}

export function ProfilePage() {
  const { npub } = useParams();
  const { user, isAuthenticated } = useAuth();

  const effectiveNpub = useMemo(() => {
    if (npub === 'me' || !npub) return user?.npub || '';
    return npub;
  }, [npub, user?.npub]);

  const [form, setForm] = useState<ProfileForm>({ bio: '', avatar: '', banner: '', website: '', twitter: '', github: '' });
  const [saved, setSaved] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="ui-card text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Sign in to manage your profile</h1>
          <p className="ui-muted mb-4">Your NIP-05 identities and profile controls are available after login.</p>
          <Link to="/" className="ui-cta inline-flex">Go home</Link>
        </div>
      </div>
    );
  }

  const nip05Addresses = user.nip05s.map((n) => `${n.localPart}@${n.domain}`);
  const verificationJson = JSON.stringify({ names: Object.fromEntries(user.nip05s.map((n) => [n.localPart, user.pubkey])) }, null, 2);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`nostr:${effectiveNpub}`)}`;

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem(`nostrmaxi_profile_${effectiveNpub}`, JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const onDownloadJson = () => {
    const blob = new Blob([verificationJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nostr.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <p className="text-sm text-gray-400">Home / Profile</p>
      <div className="ui-card">
        <h1 className="text-3xl font-semibold text-white">Profile Management</h1>
        <p className="ui-muted mt-2">Manage public metadata, social links, and NIP-05 verification assets.</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
        <form onSubmit={onSave} className="ui-card space-y-4">
          <h2 className="text-xl font-semibold text-white">Edit profile</h2>
          <textarea className="ui-input min-h-24" placeholder="Short bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <input className="ui-input" placeholder="Avatar URL" value={form.avatar} onChange={(e) => setForm({ ...form, avatar: e.target.value })} />
          <input className="ui-input" placeholder="Banner URL" value={form.banner} onChange={(e) => setForm({ ...form, banner: e.target.value })} />
          <input className="ui-input" placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <input className="ui-input" placeholder="Twitter / X" value={form.twitter} onChange={(e) => setForm({ ...form, twitter: e.target.value })} />
          <input className="ui-input" placeholder="GitHub" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} />
          <div className="flex items-center gap-3">
            <button type="submit" className="ui-cta">Save profile</button>
            {saved && <span className="text-green-400 text-sm">Saved</span>}
          </div>
        </form>

        <aside className="space-y-6">
          <div className="ui-card">
            <p className="ui-label mb-2">npub</p>
            <p className="text-white font-mono text-sm">{truncateNpub(effectiveNpub, 12)}</p>
            <img src={qrUrl} alt="npub QR" className="w-40 h-40 mt-4 rounded-lg bg-white p-2" />
          </div>

          <div className="ui-card">
            <p className="ui-label mb-3">NIP-05 addresses</p>
            {nip05Addresses.length === 0 ? (
              <p className="ui-muted">No identities yet</p>
            ) : (
              <ul className="space-y-2 text-sm text-white">
                {nip05Addresses.map((n) => <li key={n}>{n}</li>)}
              </ul>
            )}
            <button onClick={onDownloadJson} type="button" className="ui-button mt-4 w-full">Download verification JSON</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
