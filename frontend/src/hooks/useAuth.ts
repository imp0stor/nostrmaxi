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
  providerDisplayName,
  getSignerUnavailableReason,
  getSignerRuntimeDebugMarker,
  type NostrProviderId,
} from '../lib/nostr';
import type { User } from '../types';
import { requestIdentityRefresh } from '../lib/identityRefresh';
import type { NostrEvent } from '../types';

const LAST_SIGNER_STORAGE_KEY = 'nostrmaxi_last_signer';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signerDebugMarker: string;

  // Actions
  initialize: () => Promise<void>;
  loginWithExtension: (provider?: NostrProviderId) => Promise<boolean>;
  loginWithNsec: (nsec: string) => Promise<boolean>;
  loginWithLnurl: () => Promise<{ lnurl: string; k1: string } | null>;
  pollLnurlLogin: (k1: string) => Promise<boolean>;
  loginWithNostrConnect: (
    pubkey: string,
    signAuthEvent: (event: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent>
  ) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  signerDebugMarker: 'provider:none',

  initialize: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }

    try {
      const user = await api.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
      requestIdentityRefresh(user.pubkey);
    } catch (error) {
      // Token is invalid
      api.setToken(null);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  loginWithExtension: async (provider: NostrProviderId = 'alby') => {
    set({ isLoading: true, error: null, signerDebugMarker: 'provider:none' });

    try {
      const unavailableReason = getSignerUnavailableReason(provider);
      if (unavailableReason) {
        set({ error: unavailableReason, isLoading: false, signerDebugMarker: `provider:none:${provider}` });
        return false;
      }

      // Quick pre-check (main detection + retry happens inside getPublicKey/signEvent)
      if (!hasNip07Extension()) {
        // Let getPublicKey handle retry before failing to avoid extension-injection race conditions
      }

      // Get public key
      const pubkey = await getPublicKey(provider);
      if (!pubkey) {
        set({
          error: `No public key returned by ${providerDisplayName(provider)}. Please unlock/approve this signer and try again.`,
          signerDebugMarker: getSignerRuntimeDebugMarker(),
        });
        set({ isLoading: false });
        return false;
      }

      // Get challenge
      const challengeResponse = await api.getChallenge(pubkey);
      const challenge = challengeResponse?.challenge;
      if (!challenge || typeof challenge !== 'string') {
        set({ error: 'Authentication challenge was not returned by the server. Please retry in a moment.', signerDebugMarker: getSignerRuntimeDebugMarker() });
        set({ isLoading: false });
        return false;
      }

      // Create and sign auth event
      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = await signEvent(unsignedEvent, provider);

      if (!signedEvent) {
        set({
          error: `Failed to sign authentication event with ${providerDisplayName(provider)}. Please approve the request and try again.`,
          signerDebugMarker: getSignerRuntimeDebugMarker(),
        });
        set({ isLoading: false });
        return false;
      }

      // Verify with backend
      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nostrmaxi_nsec_hex');
        localStorage.setItem(LAST_SIGNER_STORAGE_KEY, provider);
      }

      set({ user, isAuthenticated: true, isLoading: false, signerDebugMarker: getSignerRuntimeDebugMarker() });
      requestIdentityRefresh(user.pubkey);
      return true;
    } catch (error) {
      const message = mapNip07Error(error);
      set({ error: `${providerDisplayName(provider)} login failed: ${message || 'Unknown error'}`, isLoading: false, signerDebugMarker: getSignerRuntimeDebugMarker() });
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

      const challengeResponse = await api.getChallenge(pubkey);
      const challenge = challengeResponse?.challenge;
      if (!challenge || typeof challenge !== 'string') {
        set({ error: 'Authentication challenge was not returned by the server. Please retry in a moment.' });
        set({ isLoading: false });
        return false;
      }

      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = signEventWithPrivateKey(unsignedEvent, privateKey);

      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('nostrmaxi_nsec_hex', privateKey);
      }

      set({ user, isAuthenticated: true, isLoading: false });
      requestIdentityRefresh(user.pubkey);
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
        requestIdentityRefresh(result.user.pubkey);
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

  loginWithNostrConnect: async (pubkey: string, signAuthEvent) => {
    set({ isLoading: true, error: null });

    try {
      if (!pubkey || !/^[a-f0-9]{64}$/i.test(pubkey)) {
        set({ error: 'Signer returned an invalid public key.', isLoading: false });
        return false;
      }

      const challengeResponse = await api.getChallenge(pubkey);
      const challenge = challengeResponse?.challenge;
      if (!challenge || typeof challenge !== 'string') {
        set({ error: 'Authentication challenge was not returned by the server. Please retry in a moment.', isLoading: false });
        return false;
      }

      const unsignedEvent = createAuthChallengeEvent(pubkey, challenge);
      const signedEvent = await signAuthEvent(unsignedEvent);

      const { token, user } = await api.verifyChallenge(signedEvent);
      api.setToken(token);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nostrmaxi_nsec_hex');
        localStorage.setItem(LAST_SIGNER_STORAGE_KEY, 'window_nostr');
      }

      set({ user, isAuthenticated: true, isLoading: false });
      requestIdentityRefresh(user.pubkey);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nostr Connect login failed';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    }
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('nostrmaxi_nsec_hex');
    }
    requestIdentityRefresh();
    set({ user: null, isAuthenticated: false });
  },

  refreshUser: async () => {
    if (!get().isAuthenticated) return;

    try {
      const user = await api.getMe();
      set({ user });
      requestIdentityRefresh(user.pubkey);
    } catch {
      // Token might have expired
      set({ user: null, isAuthenticated: false });
      api.setToken(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nostrmaxi_nsec_hex');
      }
    }
  },

  clearError: () => set({ error: null }),
}));
