import { create } from 'zustand';
import { api } from '../lib/api';

export type IdentitySource = 'managed' | 'external';
export type VerificationStatus = 'verified' | 'failed' | 'pending';

export interface IdentityView {
  address: string;
  localPart: string;
  domain: string;
  createdAt: string | null;
  source: IdentitySource;
  platform: 'nostrmaxi' | 'external';
  verificationStatus: VerificationStatus;
  verified: boolean;
  verificationMessage: string;
  verifiedAt: string | null;
  readOnly: boolean;
}

interface UnifiedResponse {
  identities: IdentityView[];
  managedCount: number;
  externalCount: number;
}

interface LegacyIdentity {
  address: string;
  localPart: string;
  domain: string;
  createdAt: string;
}

interface IdentityState {
  identities: IdentityView[];
  isLoadingManaged: boolean;
  isLoadingExternal: boolean;
  isCreating: boolean;
  error: string | null;
  success: string | null;
  loadIdentities: () => Promise<void>;
  createIdentity: (localPart: string, domain: string) => Promise<boolean>;
  deleteIdentity: (localPart: string, domain: string) => Promise<boolean>;
  clearMessages: () => void;
}

function parseErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const msg = (payload as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

export const useIdentityStore = create<IdentityState>((set, get) => ({
  identities: [],
  isLoadingManaged: true,
  isLoadingExternal: true,
  isCreating: false,
  error: null,
  success: null,

  loadIdentities: async () => {
    const token = api.getToken();
    if (!token) {
      set({
        identities: [],
        isLoadingManaged: false,
        isLoadingExternal: false,
        error: 'Please sign in again to load your identities.',
      });
      return;
    }

    set({ isLoadingManaged: true, isLoadingExternal: true, error: null });

    try {
      const [managedResponse, unifiedResponse] = await Promise.all([
        fetch('/api/v1/nip05/mine', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/v1/nip05/mine/unified', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!managedResponse.ok) {
        const payload = await managedResponse.json().catch(() => undefined);
        throw new Error(parseErrorMessage(payload, `Failed to load managed identities (HTTP ${managedResponse.status})`));
      }
      set({ isLoadingManaged: false });

      if (!unifiedResponse.ok) {
        const payload = await unifiedResponse.json().catch(() => undefined);
        throw new Error(parseErrorMessage(payload, `Failed to load external identities (HTTP ${unifiedResponse.status})`));
      }

      const managedData = (await managedResponse.json()) as LegacyIdentity[];
      const unifiedData = (await unifiedResponse.json()) as UnifiedResponse;

      const managedFromUnified = unifiedData.identities.filter((identity) => identity.source === 'managed');
      const managedFallback: IdentityView[] = managedData.map((identity) => ({
        ...identity,
        source: 'managed',
        platform: 'nostrmaxi',
        verificationStatus: 'pending',
        verified: false,
        verificationMessage: 'Verification pending',
        verifiedAt: null,
        readOnly: false,
      }));

      const managedByAddress = new Map<string, IdentityView>();
      for (const item of managedFallback) managedByAddress.set(item.address.toLowerCase(), item);
      for (const item of managedFromUnified) managedByAddress.set(item.address.toLowerCase(), item);

      const external = unifiedData.identities.filter((identity) => identity.source === 'external');
      const combined = [...managedByAddress.values(), ...external];

      set({
        identities: combined,
        error: null,
        isLoadingManaged: false,
        isLoadingExternal: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load identities. Please refresh and try again.',
        isLoadingManaged: false,
        isLoadingExternal: false,
      });
    }
  },

  createIdentity: async (localPart: string, domain: string) => {
    try {
      set({ isCreating: true, error: null, success: null });
      const response = await fetch('/api/v1/nip05/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ localPart, domain }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        throw new Error(parseErrorMessage(data, 'Failed to create identity'));
      }

      const result = await response.json();
      await get().loadIdentities();
      set({ success: `Successfully created ${result.address}!` });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to create identity' });
      return false;
    } finally {
      set({ isCreating: false });
    }
  },

  deleteIdentity: async (localPart: string, domain: string) => {
    try {
      set({ error: null, success: null });
      const response = await fetch('/api/v1/nip05', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify({ localPart, domain }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => undefined);
        throw new Error(parseErrorMessage(data, 'Failed to delete identity'));
      }

      await get().loadIdentities();
      set({ success: `Deleted ${localPart}@${domain}` });
      return true;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete identity' });
      return false;
    }
  },

  clearMessages: () => set({ error: null, success: null }),
}));
