import { decodeNpub } from './nostr';

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

export function getDefaultAnalyticsTarget(pubkey: string | undefined | null): AnalyticsTargetResolution | null {
  if (!pubkey || !HEX_PUBKEY_RE.test(pubkey)) return null;
  return {
    targetPubkey: normalizeHex(pubkey),
    normalizedInput: normalizeHex(pubkey),
    inputType: 'hex',
    fromNip05: false,
  };
}
