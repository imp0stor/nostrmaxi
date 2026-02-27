import type { NostrProfile } from '../types';

export const ONBOARDING_VERSION = 1;

export interface OnboardingProfileDraft {
  name: string;
  about: string;
  picture: string;
}

export interface OnboardingState {
  step: number;
  authMethod?: 'extension' | 'nsec' | 'lnurl';
  profile: OnboardingProfileDraft;
  followed: string[];
  skippedProfile: boolean;
  completed: boolean;
  updatedAt: number;
}

const EMPTY_PROFILE: OnboardingProfileDraft = {
  name: '',
  about: '',
  picture: '',
};

const defaultState = (): OnboardingState => ({
  step: 1,
  profile: { ...EMPTY_PROFILE },
  followed: [],
  skippedProfile: false,
  completed: false,
  updatedAt: Date.now(),
});

function keyFor(pubkey?: string): string {
  return `nostrmaxi_onboarding_v${ONBOARDING_VERSION}_${pubkey || 'anon'}`;
}

function completedKey(pubkey: string): string {
  return `nostrmaxi_onboarding_completed_v${ONBOARDING_VERSION}_${pubkey}`;
}

export function loadOnboardingState(pubkey?: string): OnboardingState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(keyFor(pubkey));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      ...defaultState(),
      ...parsed,
      profile: {
        ...EMPTY_PROFILE,
        ...(parsed.profile || {}),
      },
      followed: Array.isArray(parsed.followed) ? parsed.followed : [],
      updatedAt: parsed.updatedAt || Date.now(),
    };
  } catch {
    return defaultState();
  }
}

export function saveOnboardingState(state: OnboardingState, pubkey?: string): void {
  if (typeof window === 'undefined') return;
  const next = { ...state, updatedAt: Date.now() };
  localStorage.setItem(keyFor(pubkey), JSON.stringify(next));
}

export function clearOnboardingState(pubkey?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(keyFor(pubkey));
}

export function markOnboardingComplete(pubkey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(completedKey(pubkey), '1');
  const current = loadOnboardingState(pubkey);
  saveOnboardingState({ ...current, completed: true, step: 6 }, pubkey);
}

export function isOnboardingComplete(pubkey?: string): boolean {
  if (typeof window === 'undefined' || !pubkey) return false;
  return localStorage.getItem(completedKey(pubkey)) === '1';
}

export function profileFromDraft(draft: OnboardingProfileDraft, existing?: NostrProfile | null): NostrProfile {
  return {
    ...(existing || {}),
    name: draft.name.trim() || existing?.name,
    display_name: draft.name.trim() || existing?.display_name,
    about: draft.about.trim() || existing?.about,
    picture: draft.picture.trim() || existing?.picture,
  };
}
