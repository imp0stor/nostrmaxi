import { Link } from 'react-router-dom';

const phases = [
  {
    title: 'Phase 0: MVP ✅',
    timeline: 'Live now',
    items: [
      'NIP-05 Identity Registration',
      'Domain Selector (nostrmaxi.com + Strange Signal)',
      'BTCPay Payments',
    ],
    tone: 'border-green-500/40 bg-green-500/5',
  },
  {
    title: 'Phase 1: Core Primitives 🚧',
    timeline: 'Weeks 2-4',
    items: ['Feed Generation (Week 2)', 'Profile Management (Week 3)', 'Domain & Site Management (Week 4)'],
    tone: 'border-yellow-500/40 bg-yellow-500/5',
  },
  {
    title: 'Phase 2: Content Primitives 📅',
    timeline: 'Weeks 5-8',
    items: ['Book Authorship (Week 5-6)', 'Gift Cards (Week 7)', 'Shopping & Stores (Week 8)'],
    tone: 'border-orange-500/35 bg-orange-500/5',
  },
  {
    title: 'Phase 3: Community 📅',
    timeline: 'Weeks 9-12',
    items: ['Ratings & Reviews', 'Q&A Platform', 'Bug Bounties'],
    tone: 'border-purple-500/40 bg-purple-500/5',
  },
  {
    title: 'Phase 4: Advanced 📅',
    timeline: 'Weeks 13-16',
    items: ['Fundraising', 'Marketplace'],
    tone: 'border-nostr-orange/40 bg-nostr-orange/5',
  },
];

export function RoadmapPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="mb-8 sm:mb-10">
        <p className="text-sm text-gray-400 mb-2">Home / Roadmap</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white">🚀 NostrMaxi Roadmap</h1>
        <p className="text-gray-300 mt-3 text-base sm:text-lg">
          Building the Nostr superpower - one primitive at a time.
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {phases.map((phase) => (
          <section key={phase.title} className={`rounded-2xl border p-5 sm:p-6 ${phase.tone}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <h2 className="text-xl font-semibold text-white">{phase.title}</h2>
              <span className="text-sm text-gray-300">{phase.timeline}</span>
            </div>
            <ul className="space-y-2 text-gray-200">
              {phase.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-nostr-orange">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 ui-card text-center">
        <h3 className="text-2xl font-semibold text-white mb-3">Get Early Access - Lock in founder pricing</h3>
        <p className="text-gray-300 mb-5">Join now and secure discounted pricing before advanced phases roll out.</p>
        <Link to="/pricing" className="ui-cta inline-flex">
          View Pricing
        </Link>
      </div>
    </div>
  );
}
