import { useEffect, useMemo, useState } from 'react';

export interface RelaySuggestion {
  url: string;
  name: string;
  description: string;
  uptime: number;
  wotScore: number;
  region: string;
  type: 'free' | 'paid' | 'private';
  recommended: boolean;
}

export interface ProfileSuggestion {
  pubkey: string;
  name: string;
  nip05?: string;
  avatar: string;
  bio: string;
  followerCount: number;
  wotScore: number;
}

export interface FollowCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  profiles: ProfileSuggestion[];
}

export interface FeedDefinition {
  id: string;
  name: string;
  description: string;
  config: Record<string, unknown>;
  samplePosts: Array<{ id: string; pubkey: string; content: string; createdAt: number }>;
  subscriberCount: number;
}

export interface OnboardingState {
  step: number; // 0-6
  path?: 'premium' | 'free';
  identity: {
    pubkey: string;
    privateKey?: string;
    name?: string;
    nip05?: string;
    lightningAddress?: string;
    imported?: boolean;
    paymentComplete?: boolean;
  };
  relays: {
    selected: string[];
    suggestions: RelaySuggestion[];
  };
  follows: {
    selected: Set<string>;
    byCategory: Map<string, string[]>;
    categories: FollowCategory[];
  };
  feeds: {
    selected: string[];
    available: FeedDefinition[];
  };
  completed: boolean;
}

const MAX_STEP = 6;

const initialState: OnboardingState = {
  step: 0,
  path: undefined,
  identity: { pubkey: '' },
  relays: { selected: [], suggestions: [] },
  follows: { selected: new Set<string>(), byCategory: new Map<string, string[]>(), categories: [] },
  feeds: { selected: [], available: [] },
  completed: false,
};

const randomHex = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed request: ${url}`);
  return response.json();
}

export function useOnboarding() {
  const [state, setState] = useState<OnboardingState>(initialState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        setLoading(true);
        const [relayData, categoryData, feedData] = await Promise.all([
          getJson<{ suggestions: RelaySuggestion[]; preselected: string[] }>('/api/v1/onboarding/relay-suggestions'),
          getJson<{ categories: FollowCategory[] }>('/api/v1/onboarding/follow-categories'),
          getJson<{ feeds: FeedDefinition[] }>('/api/v1/onboarding/feeds'),
        ]);

        const byCategory = new Map<string, string[]>();
        categoryData.categories.forEach((cat) => {
          byCategory.set(cat.id, cat.profiles.map((profile) => profile.pubkey));
        });

        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          relays: { selected: relayData.preselected, suggestions: relayData.suggestions },
          follows: { selected: new Set<string>(), byCategory, categories: categoryData.categories },
          feeds: { selected: feedData.feeds.slice(0, 2).map((feed) => feed.id), available: feedData.feeds },
        }));
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load onboarding data');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, step: Math.max(0, Math.min(MAX_STEP, step)) }));
  };

  const choosePath = (path: 'premium' | 'free') => {
    setState((prev) => ({
      ...prev,
      path,
      step: path === 'premium' ? 1 : 2,
      identity: {
        ...prev.identity,
        pubkey: prev.identity.pubkey || randomHex(64),
        privateKey: prev.identity.privateKey || randomHex(64),
        paymentComplete: path === 'free' ? false : prev.identity.paymentComplete,
      },
    }));
  };

  const goNext = () => {
    setState((prev) => {
      if (!prev.path) return prev;
      const nextStep = prev.path === 'free' && prev.step === 0 ? 2 : prev.path === 'free' && prev.step === 5 ? 6 : prev.step + 1;
      return { ...prev, step: Math.min(MAX_STEP, nextStep) };
    });
  };

  const goBack = () => {
    setState((prev) => {
      if (!prev.path) return { ...prev, step: 0 };
      if (prev.path === 'free' && prev.step === 2) return { ...prev, step: 0 };
      return { ...prev, step: Math.max(0, prev.step - 1) };
    });
  };

  const generateKeys = () => {
    setState((prev) => ({
      ...prev,
      identity: {
        ...prev.identity,
        imported: false,
        privateKey: randomHex(64),
        pubkey: randomHex(64),
      },
    }));
  };

  const importPrivateKey = (privateKey: string) => {
    const cleaned = privateKey.trim().replace(/^0x/, '');
    if (!/^[a-f0-9]{64}$/i.test(cleaned)) {
      setError('Invalid private key. Paste a 64-char hex key.');
      return false;
    }
    setError('');
    setState((prev) => ({
      ...prev,
      identity: {
        ...prev.identity,
        imported: true,
        privateKey: cleaned,
        pubkey: randomHex(64),
      },
    }));
    return true;
  };

  const markPaymentComplete = () => {
    setState((prev) => ({ ...prev, identity: { ...prev.identity, paymentComplete: true } }));
  };

  const updateIdentity = (partial: Partial<OnboardingState['identity']>) => {
    setState((prev) => ({ ...prev, identity: { ...prev.identity, ...partial } }));
  };

  const toggleRelay = (url: string) => {
    setState((prev) => {
      const has = prev.relays.selected.includes(url);
      return {
        ...prev,
        relays: {
          ...prev.relays,
          selected: has ? prev.relays.selected.filter((item) => item !== url) : [...prev.relays.selected, url],
        },
      };
    });
  };

  const addManualRelay = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('wss://')) {
      setError('Relay URL must start with wss://');
      return;
    }
    setError('');
    setState((prev) => ({
      ...prev,
      relays: {
        ...prev.relays,
        selected: prev.relays.selected.includes(trimmed) ? prev.relays.selected : [...prev.relays.selected, trimmed],
      },
    }));
  };

  const isProfileSelected = (pubkey: string) => state.follows.selected.has(pubkey);

  const toggleProfile = (pubkey: string, selected: boolean) => {
    setState((prev) => {
      const next = new Set(prev.follows.selected);
      if (selected) next.add(pubkey);
      else next.delete(pubkey);
      return { ...prev, follows: { ...prev.follows, selected: next } };
    });
  };

  const selectAllInCategory = (categoryId: string) => {
    const profiles = state.follows.byCategory.get(categoryId) || [];
    setState((prev) => {
      const next = new Set(prev.follows.selected);
      profiles.forEach((pubkey) => next.add(pubkey));
      return { ...prev, follows: { ...prev.follows, selected: next } };
    });
  };

  const toggleFeed = (feedId: string) => {
    setState((prev) => {
      const has = prev.feeds.selected.includes(feedId);
      return {
        ...prev,
        feeds: {
          ...prev.feeds,
          selected: has ? prev.feeds.selected.filter((id) => id !== feedId) : [...prev.feeds.selected, feedId],
        },
      };
    });
  };

  const complete = async () => {
    const payload = {
      path: state.path,
      identity: {
        pubkey: state.identity.pubkey,
        name: state.identity.name,
        nip05: state.path === 'premium' ? state.identity.nip05 : undefined,
        lightningAddress: state.path === 'premium' ? state.identity.lightningAddress : undefined,
      },
      relays: { selected: state.relays.selected },
      follows: {
        selected: Array.from(state.follows.selected),
        categories: state.follows.categories
          .filter((cat) => cat.profiles.some((profile) => state.follows.selected.has(profile.pubkey)))
          .map((cat) => cat.id),
      },
      feeds: { selected: state.feeds.selected },
    };

    const response = await fetch('/api/v1/onboarding/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Could not complete onboarding');
    }

    setState((prev) => ({ ...prev, completed: true, step: MAX_STEP }));
    return response.json();
  };

  const selectedCategoryCount = useMemo(
    () =>
      state.follows.categories.filter((cat) =>
        cat.profiles.some((profile) => state.follows.selected.has(profile.pubkey)),
      ).length,
    [state.follows.categories, state.follows.selected],
  );

  return {
    state,
    loading,
    error,
    setError,
    setStep,
    choosePath,
    next: goNext,
    back: goBack,
    generateKeys,
    importPrivateKey,
    markPaymentComplete,
    updateIdentity,
    toggleRelay,
    addManualRelay,
    isProfileSelected,
    toggleProfile,
    selectAllInCategory,
    toggleFeed,
    complete,
    selectedFollowCount: state.follows.selected.size,
    selectedCategoryCount,
    totalSteps: MAX_STEP,
  };
}
