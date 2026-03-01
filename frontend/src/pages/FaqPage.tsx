import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

const faqs = [
  {
    question: 'What is NIP-05?',
    answer:
      'NIP-05 is a human-readable identifier for your Nostr account (like name@domain.com). It links your npub to a domain so people can verify it is really you.',
  },
  {
    question: 'How do payments work?',
    answer:
      'Payments use Bitcoin Lightning invoices. Choose monthly, annual, or lifetime, scan the invoice, and your identity is activated right after payment settles.',
  },
  {
    question: 'Is it private?',
    answer:
      'Yes. NostrMaxi only stores what is needed to provide identity and billing. We do not sell data, and your social activity remains on Nostr relays—not in a private platform silo.',
  },
  {
    question: 'Can I use my own domain?',
    answer:
      'Current checkout focuses on fast managed identities. Custom-domain support is available for higher-tier/managed setups; contact support if you need domain-level control.',
  },
];

export function FaqPage() {
  usePageMeta({
    title: 'NIP-05 FAQ',
    description:
      'Learn how NIP-05 identity works, how Lightning payments are handled, privacy expectations, and domain options on NostrMaxi.',
    path: '/faq',
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <section className="cy-card p-8">
        <p className="cy-kicker">HELP CENTER</p>
        <h1 className="cy-title text-4xl">Frequently asked questions</h1>
        <p className="text-gray-300 mt-4">
          Straight answers for identity, billing, and setup decisions before you purchase.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/pricing" className="cy-btn">View Pricing</Link>
          <Link to="/register" className="cy-btn-secondary">Start Registration</Link>
        </div>
      </section>

      <section className="space-y-4">
        {faqs.map((item) => (
          <article key={item.question} className="cy-panel p-5">
            <h2 className="text-lg font-semibold text-orange-200">{item.question}</h2>
            <p className="text-gray-300 mt-2 text-sm leading-relaxed">{item.answer}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
