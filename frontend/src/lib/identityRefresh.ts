import { invalidateProfileCache } from './profileCache';

export const IDENTITY_REFRESH_EVENT = 'nostrmaxi:identity-refresh';

export function requestIdentityRefresh(pubkey?: string): void {
  invalidateProfileCache(pubkey);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(IDENTITY_REFRESH_EVENT, { detail: { pubkey } }));
}
