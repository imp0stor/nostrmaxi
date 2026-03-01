import { decodeNpub, encodeNpub } from './nostr';
import { searchProfiles } from './beaconSearch';
import { fetchProfilesBatchCached } from './profileCache';

const HEX_PUBKEY_RE = /^[a-f0-9]{64}$/i;

export type TargetInputType = 'hex' | 'npub' | 'nip05' | 'invalid';

export interface AnalyticsTargetResolution {
  targetPubkey: string;
  normalizedInput: string;
  inputType: Exclude<TargetInputType, 'invalid'>;
  fromNip05: boolean;
}

export interface ResolveAnalyticsTargetResult {
  resolution: AnalyticsTargetResolution | null;
  error: string | null;
}

export interface AnalyticsTargetCandidate {
  targetPubkey: string;
  npub: string;
  displayName?: string;
  name?: string;
  nip05?: string;
  source: 'search' | 'profile';
}

export function classifyTargetInput(input: string): TargetInputType {
  const normalized = input.trim();
  if (!normalized) return 'invalid';
  if (HEX_PUBKEY_RE.test(normalized)) return 'hex';
  if (/^npub1/i.test(normalized)) return 'npub';
  if (normalized.includes('@') && normalized.indexOf('@') > 0 && normalized.indexOf('@') < normalized.length - 1) return 'nip05';
  return 'invalid';
}

function normalizeHex(pubkey: string): string {
  return pubkey.trim().toLowerCase();
}

async function resolveNip05(address: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/v1/nip05/${encodeURIComponent(address)}`);
    if (!response.ok) return null;
    const payload = await response.json() as { names?: Record<string, string> };
    const [localPart] = address.split('@');
    const resolved = payload?.names?.[localPart];
    if (resolved && HEX_PUBKEY_RE.test(resolved)) return normalizeHex(resolved);
    return null;
  } catch {
    return null;
  }
}

export async function resolveAnalyticsTargetIdentifier(input: string): Promise<ResolveAnalyticsTargetResult> {
  const normalizedInput = input.trim();
  const type = classifyTargetInput(normalizedInput);

  if (type === 'invalid') {
    return { resolution: null, error: 'Target must be an npub, 64-char hex pubkey, or NIP-05 address (name@domain).' };
  }

  if (type === 'hex') {
    return {
      resolution: {
        targetPubkey: normalizeHex(normalizedInput),
        normalizedInput,
        inputType: 'hex',
        fromNip05: false,
      },
      error: null,
    };
  }

  if (type === 'npub') {
    const decoded = decodeNpub(normalizedInput);
    if (!decoded || !HEX_PUBKEY_RE.test(decoded)) {
      return { resolution: null, error: 'Could not decode npub target. Please verify and try again.' };
    }
    return {
      resolution: {
        targetPubkey: normalizeHex(decoded),
        normalizedInput,
        inputType: 'npub',
        fromNip05: false,
      },
      error: null,
    };
  }

  const nip05Pubkey = await resolveNip05(normalizedInput);
  if (!nip05Pubkey) {
    return { resolution: null, error: `Could not resolve NIP-05 address: ${normalizedInput}` };
  }

  return {
    resolution: {
      targetPubkey: nip05Pubkey,
      normalizedInput,
      inputType: 'nip05',
      fromNip05: true,
    },
    error: null,
  };
}

function toCandidate(pubkey: string, data: Partial<AnalyticsTargetCandidate>, source: 'search' | 'profile'): AnalyticsTargetCandidate {
  const normalizedPubkey = normalizeHex(pubkey);
  return {
    targetPubkey: normalizedPubkey,
    npub: encodeNpub(normalizedPubkey),
    displayName: data.displayName,
    name: data.name,
    nip05: data.nip05,
    source,
  };
}

export async function findAnalyticsTargetCandidates(input: string): Promise<AnalyticsTargetCandidate[]> {
  const query = input.trim();
  if (!query) return [];

  const candidates = new Map<string, AnalyticsTargetCandidate>();

  try {
    const search = await searchProfiles({ query, limit: 20, offset: 0 });
    for (const result of search.results) {
      if (!HEX_PUBKEY_RE.test(result.pubkey)) continue;
      const candidate = toCandidate(result.pubkey, {
        displayName: result.profile?.display_name,
        name: result.name ?? result.profile?.name,
        nip05: result.nip05 ?? result.profile?.nip05,
      }, 'search');
      candidates.set(candidate.targetPubkey, candidate);
    }
  } catch {
    // Best-effort fallback only.
  }

  const type = classifyTargetInput(query);
  const lookupPubkeys: string[] = [];
  if (type === 'hex') {
    lookupPubkeys.push(normalizeHex(query));
  } else if (type === 'npub') {
    const decoded = decodeNpub(query);
    if (decoded && HEX_PUBKEY_RE.test(decoded)) lookupPubkeys.push(normalizeHex(decoded));
  }

  if (lookupPubkeys.length > 0) {
    try {
      const profiles = await fetchProfilesBatchCached(lookupPubkeys);
      for (const pubkey of lookupPubkeys) {
        if (candidates.has(pubkey)) continue;
        const profile = profiles.get(pubkey);
        candidates.set(pubkey, toCandidate(pubkey, {
          displayName: profile?.display_name,
          name: profile?.name,
          nip05: profile?.nip05,
        }, 'profile'));
      }
    } catch {
      // Ignore candidate profile lookup errors.
    }
  }

  return Array.from(candidates.values());
}

export function getDefaultAnalyticsTarget(pubkey: string | undefined | null): AnalyticsTargetResolution | null {
  if (!pubkey || !HEX_PUBKEY_RE.test(pubkey)) return null;
  return {
    targetPubkey: normalizeHex(pubkey),
    normalizedInput: normalizeHex(pubkey),
    inputType: 'hex',
    fromNip05: false,
  };
}
