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

export interface ExternalIdentity {
  platform: string;
  identity: string;
  proof: string;
  verified?: boolean;
}

export interface OnboardingProfileState {
  displayName: string;
  username: string;
  bio: string;
  picture: string;
  banner: string;
  website: string;
  lightningAddress: string;
  nip05: string;
  nip05Verified: boolean;
  externalIdentities: ExternalIdentity[];
  skippedFields: Record<string, boolean>;
}

export interface OnboardingState {
  step: number; // 0-7
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
  profile: OnboardingProfileState;
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

const MAX_STEP = 7;

const initialState: OnboardingState = {
  step: 0,
  path: undefined,
  identity: { pubkey: '' },
  profile: {
    displayName: '',
    username: '',
    bio: '',
    picture: '',
    banner: '',
    website: '',
    lightningAddress: '',
    nip05: '',
    nip05Verified: false,
    externalIdentities: [],
    skippedFields: {},
  },
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
        paymentComplete: path === 'free' ? false : prev.identity.paymentComplete,
      },
    }));
  };

  const goNext = () => {
    setState((prev) => {
      if (!prev.path) return prev;
      const nextStep = prev.path === 'free' && prev.step === 0 ? 2 : prev.step + 1;
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
    setState((prev) => ({
      ...prev,
      identity: { ...prev.identity, paymentComplete: true },
      profile: {
        ...prev.profile,
        lightningAddress: prev.profile.lightningAddress || prev.identity.lightningAddress || '',
        nip05: prev.identity.nip05 || prev.profile.nip05,
        nip05Verified: Boolean(prev.identity.paymentComplete || prev.identity.nip05),
      },
    }));
  };

  const updateIdentity = (partial: Partial<OnboardingState['identity']>) => {
    setState((prev) => ({
      ...prev,
      identity: { ...prev.identity, ...partial },
      profile: {
        ...prev.profile,
        lightningAddress: partial.lightningAddress ?? prev.profile.lightningAddress,
        nip05: partial.nip05 ?? prev.profile.nip05,
        nip05Verified: partial.nip05 ? true : prev.profile.nip05Verified,
      },
    }));
  };

  const updateProfile = (partial: Partial<OnboardingProfileState>) => {
    setState((prev) => ({ ...prev, profile: { ...prev.profile, ...partial } }));
  };

  const skipProfileField = (field: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        skippedFields: { ...prev.profile.skippedFields, [field]: true },
      },
    }));
  };

  const addExternalIdentity = (identity: ExternalIdentity) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        externalIdentities: [
          ...prev.profile.externalIdentities.filter((item) => item.platform !== identity.platform || item.identity !== identity.identity),
          identity,
        ],
      },
    }));
  };

  const removeExternalIdentity = (platform: string, identity: string) => {
    setState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        externalIdentities: prev.profile.externalIdentities.filter(
          (item) => !(item.platform === platform && item.identity === identity),
        ),
      },
    }));
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
      profile: {
        displayName: state.profile.displayName,
        username: state.profile.username,
        bio: state.profile.bio,
        picture: state.profile.picture,
        banner: state.profile.banner,
        website: state.profile.website,
        lightningAddress: state.profile.lightningAddress,
        nip05: state.profile.nip05,
        nip05Verified: state.profile.nip05Verified,
        externalIdentities: state.profile.externalIdentities,
        skippedFields: state.profile.skippedFields,
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

  const profileCompletion = useMemo(() => {
    const checks = [
      Boolean(state.profile.displayName.trim() || state.profile.skippedFields.displayName),
      Boolean(state.profile.username.trim() || state.profile.skippedFields.username),
      Boolean(state.profile.bio.trim() || state.profile.skippedFields.bio),
      Boolean(state.profile.picture.trim() || state.profile.skippedFields.picture),
      Boolean(state.profile.banner.trim() || state.profile.skippedFields.banner),
      Boolean(state.profile.website.trim() || state.profile.skippedFields.website),
      Boolean(state.profile.lightningAddress.trim() || state.profile.skippedFields.lightningAddress),
      Boolean(state.profile.nip05.trim() || state.profile.skippedFields.nip05),
      Boolean(state.profile.externalIdentities.length || state.profile.skippedFields.externalIdentities),
    ];

    const completedCount = checks.filter(Boolean).length;
    return {
      completedCount,
      totalCount: checks.length,
      percent: Math.round((completedCount / checks.length) * 100),
    };
  }, [state.profile]);

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
    selectedFollowCount: state.follows.selected.size,
    selectedCategoryCount,
    totalSteps: MAX_STEP,
  };
}
