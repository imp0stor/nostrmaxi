import { create } from 'zustand';
import { api } from '../lib/api';
import {
  hasNip07Extension,
  getPublicKey,
  createAuthChallengeEvent,
  signEvent,
  mapNip07Error,
  parseNsec,
  derivePubkey,
  signEventWithPrivateKey,
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
  loginWithNsec: (nsec: string) => Promise<boolean>;
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
      // Quick pre-check (main detection + retry happens inside getPublicKey/signEvent)
      if (!hasNip07Extension()) {
        // Let getPublicKey handle retry before failing to avoid extension-injection race conditions
      }

      // Get public key
      const pubkey = await getPublicKey();
      if (!pubkey) {
        set({ error: 'No public key returned by extension. Please unlock/approve your Nostr extension and try again.' });
        set({ isLoading: false });
        return false;
      }

      // Get challenge
      const { challenge } = await api.getChallenge(pubkey);

      // Create and sign auth event
      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = await signEvent(unsignedEvent);

      if (!signedEvent) {
        set({ error: 'Failed to sign authentication event. Please approve the connection request and try again.' });
        set({ isLoading: false });
        return false;
      }

      // Verify with backend
      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);

      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      const message = mapNip07Error(error);
      set({ error: message || 'Login failed', isLoading: false });
      return false;
    }
  },

  loginWithNsec: async (nsec: string) => {
    set({ isLoading: true, error: null });

    try {
      const privateKey = parseNsec(nsec.trim());
      if (!privateKey) {
        set({ error: 'Invalid nsec/private key format. Please paste a valid nsec or 64-char hex private key.' });
        set({ isLoading: false });
        return false;
      }

      const pubkey = await derivePubkey(privateKey);
      if (!pubkey) {
        set({ error: 'Unable to derive public key from the provided private key.' });
        set({ isLoading: false });
        return false;
      }

      const { challenge } = await api.getChallenge(pubkey);
      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = signEventWithPrivateKey(unsignedEvent, privateKey);

      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);

      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'nsec login failed';
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
