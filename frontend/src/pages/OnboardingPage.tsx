import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { LnurlQrCode } from '../components/auth/LnurlQrCode';
import { useAuth } from '../hooks/useAuth';
import { loadCuratedDiscoverUsers, loadFollowing, followPubkey, toNpub, type DiscoverUser } from '../lib/social';
import { fetchProfilesBatchCached, profileDisplayName } from '../lib/profileCache';
import { createProfileEvent, fetchProfile, hasNip07Extension, publishEvent, signEvent, signEventWithPrivateKey, truncateNpub } from '../lib/nostr';
import { clearOnboardingState, isOnboardingComplete, loadOnboardingState, markOnboardingComplete, profileFromDraft, saveOnboardingState, type OnboardingState } from '../lib/onboarding';
import { requestIdentityRefresh } from '../lib/identityRefresh';

interface StarterCard extends DiscoverUser {
  name: string;
  about?: string;
  nip05?: string;
}

const TOTAL_STEPS = 6;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, error, clearError, loginWithExtension, loginWithNsec, loginWithLnurl, pollLnurlLogin } = useAuth();

  const [state, setState] = useState<OnboardingState>(() => loadOnboardingState());
  const [hasExtension, setHasExtension] = useState(false);
  const [nsecInput, setNsecInput] = useState('');
  const [lnurlData, setLnurlData] = useState<{ lnurl: string; k1: string } | null>(null);
  const [starterAccounts, setStarterAccounts] = useState<StarterCard[]>([]);
  const [starterLoading, setStarterLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string>('');

  useEffect(() => {
    setHasExtension(hasNip07Extension());
  }, []);

  useEffect(() => {
    const loaded = loadOnboardingState(user?.pubkey);
    setState(loaded);
  }, [user?.pubkey]);

  useEffect(() => {
    saveOnboardingState(state, user?.pubkey);
  }, [state, user?.pubkey]);

  useEffect(() => {
    if (isAuthenticated && user?.pubkey && isOnboardingComplete(user.pubkey)) {
      navigate('/feed', { replace: true });
      return;
    }

    if (isAuthenticated) {
      const method = (typeof window !== 'undefined' && sessionStorage.getItem('nostrmaxi_nsec_hex')) ? 'nsec' : 'extension';
      setState((prev) => ({ ...prev, authMethod: prev.authMethod || method }));
    }
  }, [isAuthenticated, user?.pubkey, navigate]);

  useEffect(() => {
    if (state.step !== 4 || !isAuthenticated || !user?.pubkey) return;
    let active = true;
    const loadStarters = async () => {
      setStarterLoading(true);
      try {
        const [discoverPools, alreadyFollowing] = await Promise.all([
          loadCuratedDiscoverUsers(user.pubkey),
          loadFollowing(user.pubkey),
        ]);
        const candidates = discoverPools.blended.filter((c) => !alreadyFollowing.includes(c.pubkey)).slice(0, 12);
        const profileMap = await fetchProfilesBatchCached(candidates.map((c) => c.pubkey));
        if (!active) return;
        setStarterAccounts(candidates.map((c) => {
          const profile = profileMap.get(c.pubkey);
          return {
            ...c,
            name: profileDisplayName(c.pubkey, profile),
            about: profile?.about,
            nip05: profile?.nip05,
          };
        }));
      } finally {
        if (active) setStarterLoading(false);
      }
    };

    void loadStarters();
    return () => {
      active = false;
    };
  }, [state.step, isAuthenticated, user?.pubkey]);

  useEffect(() => {
    if (!lnurlData) return;
    const interval = setInterval(async () => {
      const done = await pollLnurlLogin(lnurlData.k1);
      if (done) {
        clearInterval(interval);
        setLnurlData(null);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [lnurlData, pollLnurlLogin]);

  const step = state.step;

  const canContinueProfile = useMemo(() => {
    if (state.skippedProfile) return true;
    return state.profile.name.trim().length >= 2;
  }, [state.profile.name, state.skippedProfile]);

  const setStep = (next: number) => {
    setInlineError('');
    setState((prev) => ({ ...prev, step: Math.max(1, Math.min(TOTAL_STEPS, next)) }));
  };

  const signWithCurrentAuth = async (event: Parameters<typeof signEvent>[0]) => {
    if (state.authMethod === 'nsec' && typeof window !== 'undefined') {
      const privateKey = sessionStorage.getItem('nostrmaxi_nsec_hex');
      if (privateKey) {
        return signEventWithPrivateKey(event, privateKey);
      }
    }
    return signEvent(event);
  };

  const next = () => setStep(step + 1);
  const back = () => setStep(step - 1);

  const handleAuthExtension = async () => {
    clearError();
    setActionBusy('extension');
    const ok = await loginWithExtension();
    setActionBusy(null);
    if (ok) {
      setState((prev) => ({ ...prev, authMethod: 'extension' }));
      next();
    }
  };

  const handleAuthLnurl = async () => {
    clearError();
    setActionBusy('lnurl');
    const data = await loginWithLnurl();
    setActionBusy(null);
    if (data) {
      setState((prev) => ({ ...prev, authMethod: 'lnurl' }));
      setLnurlData(data);
    }
  };

  const handleAuthNsec = async () => {
    clearError();
    if (!nsecInput.trim()) {
      setInlineError('Paste a valid nsec or 64-char private key.');
      return;
    }
    setActionBusy('nsec');
    const ok = await loginWithNsec(nsecInput.trim());
    setActionBusy(null);
    if (ok) {
      setState((prev) => ({ ...prev, authMethod: 'nsec' }));
      next();
    }
  };

  const handleSaveProfile = async () => {
    if (!isAuthenticated || !user?.pubkey) {
      setInlineError('Please authenticate first.');
      return;
    }
    if (!state.skippedProfile && !canContinueProfile) {
      setInlineError('Name must be at least 2 characters, or choose Skip for now.');
      return;
    }

    if (state.skippedProfile) {
      next();
      return;
    }

    try {
      setActionBusy('profile');
      const current = await fetchProfile(user.pubkey);
      const unsigned = createProfileEvent(user.pubkey, profileFromDraft(state.profile, current));
      const signed = await signWithCurrentAuth(unsigned);
      if (!signed) throw new Error('Could not sign profile update.');
      const result = await publishEvent(signed);
      if (!result.success) throw new Error('Profile publish failed on relays.');
      requestIdentityRefresh(user.pubkey);
      next();
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setActionBusy(null);
    }
  };

  const followStarter = async (pubkey: string) => {
    if (!user?.pubkey) return;
    if (state.followed.includes(pubkey)) return;

    setState((prev) => ({ ...prev, followed: [...prev.followed, pubkey] }));
    const ok = await followPubkey(user.pubkey, pubkey, signWithCurrentAuth, publishEvent);
    if (!ok) {
      setState((prev) => ({ ...prev, followed: prev.followed.filter((x) => x !== pubkey) }));
      setInlineError('Failed to follow that account. Try again.');
      return;
    }
    requestIdentityRefresh(user.pubkey);
  };

  const finishOnboarding = () => {
    if (user?.pubkey) {
      markOnboardingComplete(user.pubkey);
      clearOnboardingState(user.pubkey);
    }
    navigate('/feed?onboarding=done', { replace: true });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">ONBOARDING</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="cy-title">Welcome to NostrMaxi</h1>
          <p className="text-sm text-cyan-200">Step {step}/{TOTAL_STEPS}</p>
        </div>
        <div className="mt-4 h-2 rounded bg-slate-900 border border-cyan-500/20 overflow-hidden">
          <div className="h-full bg-cyan-400/70" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
        </div>
      </header>

      {!!(error || inlineError) && (
        <div className="cy-card p-4 border-red-400/40 text-red-200 text-sm">{inlineError || error}</div>
      )}

      {step === 1 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">Quick start in 20 seconds</h2>
          <p className="text-gray-300">You own your Nostr keys. We keep setup simple so you can claim one NIP-05 identity and start using it fast.</p>
          <ul className="text-sm text-cyan-100 list-disc ml-6 space-y-1">
            <li>Your key = your account</li>
            <li>Choose monthly, annual, or lifetime registration</li>
            <li>NIP-05 setup takes only a few minutes</li>
          </ul>
          <div className="flex justify-end">
            <button className="cy-btn" onClick={next}>Start setup</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">Choose how you sign in</h2>
          <p className="text-sm text-gray-300">Use whatever feels easiest. You can always switch clients later.</p>

          {isAuthenticated && user ? (
            <div className="p-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-200">
              Signed in as {truncateNpub(user.npub, 8)}. Continue to profile setup.
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                <button onClick={handleAuthExtension} disabled={!hasExtension || isLoading || actionBusy !== null} className={`cy-chip text-left p-4 ${hasExtension ? '' : 'opacity-60 cursor-not-allowed'}`}>
                  <div className="font-semibold text-cyan-100">Browser Extension</div>
                  <div className="text-xs text-gray-400">{hasExtension ? 'Recommended: Alby, nos2x' : 'No extension detected yet'}</div>
                </button>

                <button onClick={handleAuthLnurl} disabled={isLoading || actionBusy !== null} className="cy-chip text-left p-4">
                  <div className="font-semibold text-cyan-100">LNURL (Lightning Wallet)</div>
                  <div className="text-xs text-gray-400">Scan and approve with a wallet that supports LNURL-auth.</div>
                </button>

                <div className="p-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 space-y-2">
                  <div className="font-semibold text-yellow-200">nsec fallback</div>
                  <textarea value={nsecInput} onChange={(e) => setNsecInput(e.target.value)} rows={2} className="w-full bg-slate-950/80 border border-yellow-300/40 rounded px-3 py-2 text-sm" placeholder="nsec1..." />
                  <button onClick={handleAuthNsec} disabled={isLoading || actionBusy !== null} className="cy-btn-secondary text-sm">Continue with nsec</button>
                </div>
              </div>

              {lnurlData && (
                <div className="cy-card p-4 text-center">
                  <LnurlQrCode lnurl={lnurlData.lnurl} />
                  <p className="text-sm text-gray-300 mt-3">Scan to authenticate. We’ll move to next step automatically.</p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <button className="cy-btn-secondary" onClick={back}>Back</button>
            <button className="cy-btn" disabled={!isAuthenticated} onClick={next}>Continue</button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">Profile basics</h2>
          <p className="text-sm text-gray-300">Optional but helpful. You can skip and edit later.</p>
          <div className="grid gap-3">
            <label className="text-sm text-cyan-100">Display name *</label>
            <input value={state.profile.name} onChange={(e) => setState((prev) => ({ ...prev, skippedProfile: false, profile: { ...prev.profile, name: e.target.value } }))} className="cy-input" placeholder="Your name" />
            <label className="text-sm text-cyan-100">Bio</label>
            <textarea value={state.profile.about} onChange={(e) => setState((prev) => ({ ...prev, skippedProfile: false, profile: { ...prev.profile, about: e.target.value } }))} className="cy-input min-h-24" placeholder="What are you into?" />
            <label className="text-sm text-cyan-100">Avatar URL (optional)</label>
            <input value={state.profile.picture} onChange={(e) => setState((prev) => ({ ...prev, skippedProfile: false, profile: { ...prev.profile, picture: e.target.value } }))} className="cy-input" placeholder="https://..." />
            {state.profile.picture ? <img src={state.profile.picture} alt="Avatar preview" className="w-16 h-16 rounded-full border border-cyan-500/30 object-cover" onError={() => setInlineError('Avatar URL looks invalid. You can still skip this.')} /> : null}
          </div>
          <div className="flex justify-between">
            <button className="cy-btn-secondary" onClick={back}>Back</button>
            <div className="flex gap-2">
              <button className="cy-btn-secondary" onClick={() => { setState((prev) => ({ ...prev, skippedProfile: true })); next(); }}>Skip for now</button>
              <button className="cy-btn" disabled={actionBusy === 'profile'} onClick={handleSaveProfile}>{actionBusy === 'profile' ? 'Saving…' : 'Save & Continue'}</button>
            </div>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">Follow starter accounts</h2>
          <p className="text-sm text-gray-300">Suggestions are curated with Web-of-Trust signals.</p>
          {starterLoading ? <p className="text-cyan-200">Loading recommendations…</p> : (
            <div className="grid md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-1">
              {starterAccounts.map((card) => {
                const followed = state.followed.includes(card.pubkey);
                return (
                  <div key={card.pubkey} className="rounded-lg border border-cyan-400/30 bg-slate-950/70 p-3">
                    <div className="flex gap-3 items-start">
                      <Avatar pubkey={card.pubkey} size={40} clickable={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-cyan-100 font-medium truncate">{card.nip05 || card.name || truncateNpub(toNpub(card.pubkey), 8)}</p>
                        <p className="text-xs text-gray-400 line-clamp-2">{card.about || 'Active Nostr account'}</p>
                        <button className={`mt-2 cy-chip text-xs ${followed ? 'opacity-70' : ''}`} disabled={followed} onClick={() => followStarter(card.pubkey)}>{followed ? 'Following' : 'Follow'}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-between">
            <button className="cy-btn-secondary" onClick={back}>Back</button>
            <button className="cy-btn" onClick={next}>Continue</button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">Claim your NIP-05 identity</h2>
          <p className="text-gray-300">Pick a simple individual plan and activate your NIP-05 address (for example <code className="cy-mono">you@nostrmaxi.com</code>).</p>
          <div className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 p-4 text-sm text-fuchsia-100">
            This flow is built for individuals: one identity, fast setup, no team configuration.
          </div>
          <div className="flex gap-3">
            <Link to="/pricing" className="cy-btn">Choose plan</Link>
            <button className="cy-btn-secondary" onClick={next}>Do this later</button>
          </div>
          <div className="flex justify-between">
            <button className="cy-btn-secondary" onClick={back}>Back</button>
            <button className="cy-btn" onClick={next}>Continue</button>
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="cy-card p-6 space-y-4">
          <h2 className="text-xl text-cyan-100 font-semibold">You’re ready ⚡</h2>
          <p className="text-gray-300">Head to your feed and try these first actions:</p>
          <ul className="text-sm text-cyan-100 list-disc ml-6 space-y-1">
            <li>Write your first note</li>
            <li>Like or reply to one post</li>
            <li>Discover more people from the Discover tab</li>
          </ul>
          <div className="flex items-center gap-3">
            <button className="cy-btn" onClick={finishOnboarding}>Open Feed</button>
            <Link className="cy-btn-secondary" to="/discover">Browse Discover</Link>
          </div>
        </section>
      )}
    </div>
  );
}
