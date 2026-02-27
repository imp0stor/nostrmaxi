import {
  clearOnboardingState,
  isOnboardingComplete,
  loadOnboardingState,
  markOnboardingComplete,
  saveOnboardingState,
} from '../../frontend/src/lib/onboarding';

describe('frontend onboarding state persistence', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
          removeItem: (key: string) => {
            store.delete(key);
          },
        },
      },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global, 'localStorage', {
      value: (global as any).window.localStorage,
      configurable: true,
      writable: true,
    });
  });

  it('loads defaults and round-trips saved step state', () => {
    const initial = loadOnboardingState('abc');
    expect(initial.step).toBe(1);
    expect(initial.completed).toBe(false);

    saveOnboardingState({ ...initial, step: 4, followed: ['pubkey1'] }, 'abc');

    const loaded = loadOnboardingState('abc');
    expect(loaded.step).toBe(4);
    expect(loaded.followed).toEqual(['pubkey1']);
  });

  it('marks completion and clears in-progress payload', () => {
    saveOnboardingState({ ...loadOnboardingState('xyz'), step: 3 }, 'xyz');
    markOnboardingComplete('xyz');

    expect(isOnboardingComplete('xyz')).toBe(true);

    clearOnboardingState('xyz');
    const loaded = loadOnboardingState('xyz');
    expect(loaded.step).toBe(1);
    expect(loaded.completed).toBe(false);
    expect(isOnboardingComplete('xyz')).toBe(true);
  });
});
