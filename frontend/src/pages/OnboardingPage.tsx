import { OnboardingFeeds } from '../components/onboarding/OnboardingFeeds';
import { OnboardingFollows } from '../components/onboarding/OnboardingFollows';
import { OnboardingPathChoice } from '../components/onboarding/OnboardingPathChoice';
import { OnboardingProfile } from '../components/onboarding/OnboardingProfile';
import { OnboardingRelays } from '../components/onboarding/OnboardingRelays';
import { OnboardingReview } from '../components/onboarding/OnboardingReview';
import { OnboardingSuccess } from '../components/onboarding/OnboardingSuccess';
import { OnboardingWelcome } from '../components/onboarding/OnboardingWelcome';
import { useOnboarding } from '../hooks/useOnboarding';

export function OnboardingPage() {
  const {
    state,
    loading,
    error,
    setError,
    setStep,
    choosePath,
    next,
    back,
    generateKeys,
    importPrivateKey,
    markPaymentComplete,
    updateIdentity,
    updateProfile,
    skipProfileField,
    addExternalIdentity,
    removeExternalIdentity,
    toggleRelay,
    addManualRelay,
    isProfileSelected,
    toggleProfile,
    selectAllInCategory,
    toggleFeed,
    complete,
    profileCompletion,
    selectedFollowCount,
    selectedCategoryCount,
    totalSteps,
  } = useOnboarding();

  const selectedCategoryNames = state.follows.categories
    .filter((category) => category.profiles.some((profile) => state.follows.selected.has(profile.pubkey)))
    .map((category) => category.name);

  const selectedFeedNames = state.feeds.available
    .filter((feed) => state.feeds.selected.includes(feed.id))
    .map((feed) => feed.name);

  const renderStep = () => {
    if (state.completed || state.step === 7) {
      return <OnboardingSuccess />;
    }

    switch (state.step) {
      case 0:
        return <OnboardingPathChoice onChoose={choosePath} />;
      case 1:
        return (
          <OnboardingWelcome
            state={state}
            onGenerate={generateKeys}
            onImport={importPrivateKey}
            onIdentityChange={updateIdentity}
            onPaid={markPaymentComplete}
            onBack={back}
            onNext={next}
          />
        );
      case 2:
        return (
          <OnboardingProfile
            profile={state.profile}
            pubkey={state.identity.pubkey}
            selectedCategoryNames={selectedCategoryNames}
            selectedFeedNames={selectedFeedNames}
            hasPremiumNip05={state.path === 'premium' && Boolean(state.identity.nip05)}
            onProfileChange={updateProfile}
            onSkipField={skipProfileField}
            onAddExternalIdentity={addExternalIdentity}
            onRemoveExternalIdentity={removeExternalIdentity}
            profileCompletion={profileCompletion}
            onBack={back}
            onNext={next}
          />
        );
      case 3:
        return (
          <OnboardingRelays
            relays={state.relays}
            onToggleRelay={toggleRelay}
            onAddManualRelay={addManualRelay}
            onBack={back}
            onNext={next}
          />
        );
      case 4:
        return (
          <OnboardingFollows
            categories={state.follows.categories}
            selectedCount={selectedFollowCount}
            isSelected={isProfileSelected}
            onToggleProfile={toggleProfile}
            onSelectAllCategory={selectAllInCategory}
            onBack={back}
            onNext={next}
          />
        );
      case 5:
        return (
          <OnboardingFeeds
            feeds={state.feeds}
            onToggleFeed={toggleFeed}
            onBack={back}
            onNext={next}
          />
        );
      case 6:
        return (
          <OnboardingReview
            state={state}
            selectedFollowCount={selectedFollowCount}
            selectedCategoryCount={selectedCategoryCount}
            onEditStep={setStep}
            onBack={back}
            onComplete={async () => {
              try {
                await complete();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="cy-card p-5">
        <p className="cy-kicker">ONBOARDING</p>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="cy-title">Join NostrMaxi</h1>
          <p className="text-sm text-cyan-200">Step {state.step}/{totalSteps}</p>
        </div>
        <div className="mt-4 h-2 rounded bg-slate-900 border border-cyan-500/20 overflow-hidden">
          <div className="h-full bg-cyan-400/70 transition-all duration-300" style={{ width: `${(state.step / totalSteps) * 100}%` }} />
        </div>
      </header>

      {loading ? <div className="cy-card p-4 text-cyan-200">Loading onboarding data…</div> : null}
      {error ? <div className="cy-card p-4 border-red-400/40 text-red-200 text-sm">{error}</div> : null}

      {!loading ? renderStep() : null}
    </div>
  );
}
