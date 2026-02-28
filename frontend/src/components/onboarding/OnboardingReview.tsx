import type { OnboardingState } from '../../hooks/useOnboarding';

interface Props {
  state: OnboardingState;
  selectedFollowCount: number;
  selectedCategoryCount: number;
  onEditStep: (step: number) => void;
  onComplete: () => Promise<void>;
  onBack: () => void;
}

export function OnboardingReview({
  state,
  selectedFollowCount,
  selectedCategoryCount,
  onEditStep,
  onComplete,
  onBack,
}: Props) {
  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Review and confirm</h2>
      <div className="space-y-3 text-sm">
        <div className="rounded border border-cyan-500/20 p-3 bg-slate-950/60 flex items-center justify-between">
          <p>
            Identity: {state.path === 'premium'
              ? state.identity.nip05 || `${state.identity.name || 'name'}@nostrmaxi.com`
              : `${state.identity.pubkey ? 'Free account (no NIP-05 yet)' : 'Free account'}`}
          </p>
          <button className="cy-btn-secondary text-xs" onClick={() => onEditStep(state.path === 'premium' ? 1 : 0)}>Edit</button>
        </div>
        <div className="rounded border border-cyan-500/20 p-3 bg-slate-950/60 flex items-center justify-between">
          <p>Relays selected: {state.relays.selected.length}</p>
          <button className="cy-btn-secondary text-xs" onClick={() => onEditStep(2)}>Edit</button>
        </div>
        <div className="rounded border border-cyan-500/20 p-3 bg-slate-950/60 flex items-center justify-between">
          <p>Following: {selectedFollowCount} accounts across {selectedCategoryCount} categories</p>
          <button className="cy-btn-secondary text-xs" onClick={() => onEditStep(3)}>Edit</button>
        </div>
        <div className="rounded border border-cyan-500/20 p-3 bg-slate-950/60 flex items-center justify-between">
          <p>Feeds subscribed: {state.feeds.selected.length}</p>
          <button className="cy-btn-secondary text-xs" onClick={() => onEditStep(4)}>Edit</button>
        </div>
      </div>

      <div className="flex justify-between">
        <button className="cy-btn-secondary" onClick={onBack}>Back</button>
        <button className="cy-btn" onClick={() => void onComplete()}>Create account</button>
      </div>
    </section>
  );
}
