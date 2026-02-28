import { AIBioHelper } from './AIBioHelper';
import { ExternalAccountLink } from './ExternalAccountLink';
import { OnboardingInterests } from './OnboardingInterests';
import { ProfileImageUpload } from './ProfileImageUpload';
import type { OnboardingProfileState, ExternalIdentity } from '../../hooks/useOnboarding';

interface Props {
  profile: OnboardingProfileState;
  pubkey?: string;
  selectedCategoryNames: string[];
  selectedFeedNames: string[];
  hasPremiumNip05: boolean;
  onProfileChange: (partial: Partial<OnboardingProfileState>) => void;
  onSkipField: (field: string) => void;
  onAddExternalIdentity: (identity: ExternalIdentity) => void;
  onRemoveExternalIdentity: (platform: string, identity: string) => void;
  profileCompletion: { completedCount: number; totalCount: number; percent: number };
  onBack: () => void;
  onNext: () => void;
}

export function OnboardingProfile({
  profile,
  pubkey,
  selectedCategoryNames,
  selectedFeedNames,
  hasPremiumNip05,
  onProfileChange,
  onSkipField,
  onAddExternalIdentity,
  onRemoveExternalIdentity,
  profileCompletion,
  onBack,
  onNext,
}: Props) {
  return (
    <section className="cy-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl text-cyan-100 font-semibold">Step 2: Set Up Your Profile</h2>
        <p className="text-xs text-cyan-300">{profileCompletion.completedCount}/{profileCompletion.totalCount} sections complete ({profileCompletion.percent}%)</p>
      </div>

      <div className="h-2 rounded bg-slate-900 border border-cyan-500/20 overflow-hidden">
        <div className="h-full bg-cyan-400/70 transition-all duration-300" style={{ width: `${profileCompletion.percent}%` }} />
      </div>

      <ProfileImageUpload
        label="📷 Profile Picture"
        value={profile.picture}
        placeholder="https://example.com/avatar.jpg"
        onChange={(value) => onProfileChange({ picture: value })}
        onSkip={() => onSkipField('picture')}
      />

      <ProfileImageUpload
        label="🖼️ Banner Image"
        value={profile.banner}
        placeholder="https://example.com/banner.jpg"
        onChange={(value) => onProfileChange({ banner: value })}
        onSkip={() => onSkipField('banner')}
        previewFallback="🖼️"
      />

      <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-cyan-100">✏️ Display Name</label>
          <button type="button" className="text-xs text-cyan-300 underline" onClick={() => onSkipField('displayName')}>Skip</button>
        </div>
        <input className="cy-input" value={profile.displayName} onChange={(e) => onProfileChange({ displayName: e.target.value })} placeholder="Satoshi" />
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-cyan-100">Username / Name (optional)</label>
          <button type="button" className="text-xs text-cyan-300 underline" onClick={() => onSkipField('username')}>Skip</button>
        </div>
        <input className="cy-input" value={profile.username} onChange={(e) => onProfileChange({ username: e.target.value })} placeholder="nostrmaxi" />
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm text-cyan-100">📝 About You</label>
          <button type="button" className="text-xs text-cyan-300 underline" onClick={() => onSkipField('bio')}>Skip</button>
        </div>
        <textarea className="cy-input min-h-24" value={profile.bio} onChange={(e) => onProfileChange({ bio: e.target.value })} placeholder="Write a short bio..." />
        <AIBioHelper
          context={{
            selectedCategories: selectedCategoryNames,
            selectedFeeds: selectedFeedNames,
            interests: profile.interests,
            website: profile.website,
            externalIdentities: profile.externalIdentities,
          }}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-cyan-100">🔗 Website</label>
            <button type="button" className="text-xs text-cyan-300 underline" onClick={() => onSkipField('website')}>Skip</button>
          </div>
          <input className="cy-input" value={profile.website} onChange={(e) => onProfileChange({ website: e.target.value })} placeholder="https://example.com" />
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-cyan-100">⚡ Lightning Address</label>
            <button type="button" className="text-xs text-cyan-300 underline" onClick={() => onSkipField('lightningAddress')}>Skip</button>
          </div>
          <input
            className="cy-input"
            value={profile.lightningAddress}
            onChange={(e) => onProfileChange({ lightningAddress: e.target.value })}
            placeholder="you@getalby.com"
          />
          <p className="text-[11px] text-gray-400">Shown if not already finalized during NIP-05 setup.</p>
        </div>
      </div>

      <div className="rounded-lg border border-cyan-500/20 bg-slate-950/50 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-sm text-cyan-100">NIP-05 Verification</label>
          <span className={`text-xs ${profile.nip05Verified || hasPremiumNip05 ? 'text-emerald-300' : 'text-yellow-300'}`}>
            {profile.nip05Verified || hasPremiumNip05 ? 'Purchased / verified ✓' : 'Not purchased yet'}
          </span>
        </div>
        <input className="cy-input" value={profile.nip05} onChange={(e) => onProfileChange({ nip05: e.target.value })} placeholder="name@nostrmaxi.com" />
      </div>

      <ExternalAccountLink
        pubkey={pubkey}
        identities={profile.externalIdentities}
        onAdd={onAddExternalIdentity}
        onRemove={onRemoveExternalIdentity}
        onSkip={() => onSkipField('externalIdentities')}
      />

      <OnboardingInterests
        selected={profile.interests}
        custom={profile.customInterests}
        onChange={({ interests, customInterests }) => onProfileChange({ interests, customInterests })}
        onSkip={() => onSkipField('interests')}
      />

      <div className="flex justify-between gap-2 flex-wrap">
        <button className="cy-btn-secondary" onClick={onBack}>← Back</button>
        <div className="flex gap-2">
          <button className="cy-btn-secondary" onClick={() => { onSkipField('profile'); onNext(); }}>Skip Profile Setup</button>
          <button className="cy-btn" onClick={onNext}>Continue →</button>
        </div>
      </div>
    </section>
  );
}
