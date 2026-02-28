import type { FollowCategory } from '../../hooks/useOnboarding';

interface Props {
  categories: FollowCategory[];
  selectedCount: number;
  isSelected: (pubkey: string) => boolean;
  onToggleProfile: (pubkey: string, selected: boolean) => void;
  onSelectAllCategory: (categoryId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function OnboardingFollows({
  categories,
  selectedCount,
  isSelected,
  onToggleProfile,
  onSelectAllCategory,
  onNext,
  onBack,
}: Props) {
  return (
    <section className="cy-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl text-cyan-100 font-semibold">Suggested follows</h2>
        <p className="text-sm text-cyan-300">Total selected: {selectedCount}</p>
      </div>

      <div className="space-y-4 max-h-[52vh] overflow-y-auto pr-1">
        {categories.map((category) => (
          <div key={category.id} className="rounded-lg border border-cyan-500/30 p-4 bg-slate-950/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-cyan-100 font-semibold">{category.icon} {category.name}</p>
                <p className="text-xs text-gray-400">{category.description}</p>
              </div>
              <button className="cy-btn-secondary text-xs" onClick={() => onSelectAllCategory(category.id)}>Select all</button>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mt-3">
              {category.profiles.map((profile) => {
                const selected = isSelected(profile.pubkey);
                return (
                  <button
                    key={profile.pubkey}
                    className={`text-left rounded-lg border p-3 ${selected ? 'border-cyan-400 bg-cyan-500/10' : 'border-cyan-500/20 bg-slate-900/60'}`}
                    onClick={() => onToggleProfile(profile.pubkey, !selected)}
                  >
                    <div className="flex items-start gap-3">
                      <img src={profile.avatar} alt={profile.name} className="w-10 h-10 rounded-full object-cover" />
                      <div className="min-w-0">
                        <p className="text-cyan-100 font-medium truncate">{profile.name}</p>
                        <p className="text-xs text-gray-400 truncate">{profile.nip05 || 'No NIP-05 listed'}</p>
                        <p className="text-xs text-gray-300 line-clamp-2 mt-1">{profile.bio}</p>
                        <p className="text-xs text-cyan-300 mt-1">{profile.followerCount.toLocaleString()} followers • WoT {profile.wotScore}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <button className="cy-btn-secondary" onClick={onBack}>Back</button>
        <div className="flex gap-2">
          <button className="cy-btn-secondary" onClick={onNext}>Skip</button>
          <button className="cy-btn" onClick={onNext}>Continue</button>
        </div>
      </div>
    </section>
  );
}
