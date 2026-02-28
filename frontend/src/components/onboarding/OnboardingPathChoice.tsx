interface Props {
  onChoose: (path: 'premium' | 'free') => void;
}

export function OnboardingPathChoice({ onChoose }: Props) {
  return (
    <section className="cy-card p-6 space-y-5">
      <h2 className="text-2xl text-cyan-100 font-semibold">Welcome to NostrMaxi</h2>
      <p className="text-gray-300">How would you like to get started?</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 p-5 space-y-3">
          <p className="text-lg text-fuchsia-100 font-semibold">🏆 Get Verified Identity</p>
          <p className="text-sm text-gray-300">Register your NIP-05 address <span className="cy-mono">yourname@nostrmaxi.com</span></p>
          <ul className="text-sm text-fuchsia-100 list-disc ml-5 space-y-1">
            <li>Verified identity badge</li>
            <li>Lightning address included</li>
            <li>Premium support</li>
          </ul>
          <p className="text-sm text-fuchsia-200 font-semibold">Starting at 21,000 sats</p>
          <button className="cy-btn w-full" onClick={() => onChoose('premium')}>Get Started →</button>
        </div>

        <div className="rounded-xl border border-cyan-500/30 bg-slate-950/70 p-5 space-y-3">
          <p className="text-lg text-cyan-100 font-semibold">🆓 Start Free</p>
          <p className="text-sm text-gray-300">Jump right in without paying. Upgrade to NIP-05 anytime later.</p>
          <div className="h-[78px]" />
          <button className="cy-btn-secondary w-full" onClick={() => onChoose('free')}>Continue Free →</button>
        </div>
      </div>
    </section>
  );
}
