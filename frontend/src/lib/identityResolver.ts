import type { User } from '../types';
import { truncateNpub } from './nostr';
import { fetchProfileCached, invalidateProfileCache, isValidNip05 } from './profileCache';
import { api } from './api';

interface UnifiedIdentity {
  address: string;
  source: 'managed' | 'external';
  verified?: boolean;
  verificationStatus?: 'verified' | 'failed' | 'pending';
}

interface UnifiedResponse {
  identities: UnifiedIdentity[];
}

export type IdentitySource = 'external' | 'managed' | 'npub';

export interface IdentityResolution {
  value: string;
  source: IdentitySource;
  externalNip05?: string;
  managedNip05?: string;
}

export function selectPrimaryIdentity(options: { externalNip05?: string | null; managedNip05?: string | null; npub: string }): string {
  return selectPrimaryIdentityDetailed(options).value;
}

export function selectPrimaryIdentityDetailed(options: { externalNip05?: string | null; managedNip05?: string | null; npub: string }): IdentityResolution {
  const external = isValidNip05(options.externalNip05) ? options.externalNip05!.trim() : undefined;
  const managed = isValidNip05(options.managedNip05) ? options.managedNip05!.trim() : undefined;

  if (external) return { value: external, source: 'external', externalNip05: external, managedNip05: managed };
  if (managed) return { value: managed, source: 'managed', externalNip05: external, managedNip05: managed };
  return { value: truncateNpub(options.npub, 4), source: 'npub', externalNip05: external, managedNip05: managed };
}

async function fetchManagedIdentity(): Promise<string | undefined> {
  const token = api.getToken();
  if (!token) return undefined;

  const response = await fetch('/api/v1/nip05/mine/unified', { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) return undefined;
  const body = await response.json() as UnifiedResponse;
  const managed = body.identities.find((identity) => identity.source === 'managed' && (identity.verified || identity.verificationStatus === 'verified'))
    || body.identities.find((identity) => identity.source === 'managed');
  return managed?.address;
}

export async function resolvePrimaryIdentityDetailed(user: User, opts?: { forceRefresh?: boolean }): Promise<IdentityResolution> {
  if (opts?.forceRefresh) invalidateProfileCache(user.pubkey);

  const [profile, managedNip05] = await Promise.all([
    fetchProfileCached(user.pubkey),
    fetchManagedIdentity(),
  ]);

  const resolution = selectPrimaryIdentityDetailed({
    externalNip05: profile?.nip05,
    managedNip05,
    npub: user.npub,
  });

  if (typeof console !== 'undefined') {
    console.info('[identity] header identity selected', {
      source: resolution.source,
      value: resolution.value,
      externalNip05: resolution.externalNip05 ?? null,
      managedNip05: resolution.managedNip05 ?? null,
      forceRefresh: Boolean(opts?.forceRefresh),
      pubkey: user.pubkey,
    });
  }

  return resolution;
}

export async function resolvePrimaryIdentity(user: User, opts?: { forceRefresh?: boolean }): Promise<string> {
  const resolution = await resolvePrimaryIdentityDetailed(user, opts);
  return resolution.value;
}
