import { Link } from 'react-router-dom';

export function OnboardingSuccess() {
  return (
    <section className="cy-card p-6 space-y-4">
      <h2 className="text-xl text-cyan-100 font-semibold">Welcome to NostrMaxi ⚡</h2>
      <p className="text-gray-300">Your onboarding is complete. Your account, relay set, follows, and feeds are ready.</p>
      <div className="grid md:grid-cols-3 gap-3">
        <Link to="/feed" className="cy-btn text-center">Explore feed</Link>
        <Link to="/discover" className="cy-btn-secondary text-center">Make first post</Link>
        <Link to="/pricing" className="cy-btn-secondary text-center">Invite friends</Link>
      </div>
      <div className="rounded border border-cyan-500/20 bg-slate-950/60 p-3 text-sm text-gray-300">
        Next: complete your profile with avatar/banner and verify your preferred NIP-05 identity.
      </div>
    </section>
  );
}
