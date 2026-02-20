import { create } from 'zustand';
import { api } from '../lib/api';
import {
  hasNip07Extension,
  getPublicKey,
  createAuthChallengeEvent,
  signEvent,
} from '../lib/nostr';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  initialize: () => Promise<void>;
  loginWithExtension: () => Promise<boolean>;
  loginWithLnurl: () => Promise<{ lnurl: string; k1: string } | null>;
  pollLnurlLogin: (k1: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  initialize: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // Token is invalid
      api.setToken(null);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  loginWithExtension: async () => {
    set({ isLoading: true, error: null });

    try {
      // Check for NIP-07 extension
      if (!hasNip07Extension()) {
        set({ error: 'No Nostr extension found. Please install nos2x, Alby, or similar.' });
        set({ isLoading: false });
        return false;
      }

      // Get public key
      const pubkey = await getPublicKey();
      if (!pubkey) {
        set({ error: 'Failed to get public key from extension' });
        set({ isLoading: false });
        return false;
      }

      // Get challenge
      const { challenge } = await api.getChallenge(pubkey);

      // Create and sign auth event
      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = await signEvent(unsignedEvent);

      if (!signedEvent) {
        set({ error: 'Failed to sign authentication event' });
        set({ isLoading: false });
        return false;
      }

      // Verify with backend
      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);

      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithLnurl: async () => {
    set({ isLoading: true, error: null });

    try {
      const { lnurl, k1 } = await api.getLnurlAuth();
      set({ isLoading: false });
      return { lnurl, k1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate LNURL';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  pollLnurlLogin: async (k1: string) => {
    try {
      const result = await api.pollLnurlAuth(k1);
      
      if (result.status === 'verified' && result.token && result.user) {
        api.setToken(result.token);
        set({ user: result.user, isAuthenticated: true });
        return true;
      }
      
      if (result.status === 'expired') {
        set({ error: 'LNURL session expired. Please try again.' });
        return true; // Stop polling
      }

      return false; // Keep polling
    } catch (error) {
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    if (!get().isAuthenticated) return;

    try {
      const user = await api.getMe();
      set({ user });
    } catch {
      // Token might have expired
      set({ user: null, isAuthenticated: false });
      api.setToken(null);
    }
  },

  clearError: () => set({ error: null }),
}));
