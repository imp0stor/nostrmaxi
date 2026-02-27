import { useEffect, useMemo, useState } from 'react';

export type ExternalIdentityStatus = 'verified' | 'unverified' | 'failed' | 'stale';

export interface ExternalIdentityProof {
  platform: string;
  identity: string;
  proof?: string;
  claim?: string;
  verified: boolean;
  verificationStatus: ExternalIdentityStatus;
  verifiedAt?: string;
  error?: string;
  github?: {
    login: string;
    publicRepos: number;
    followers: number;
    languages: string[];
    url: string;
  };
  twitter?: {
    handle: string;
    profileUrl: string;
    proofUrl?: string;
  };
  linkUrl?: string;
}

export interface NostrProfileLike {
  i?: Array<string | string[]>;
  tags?: string[][];
}

const VERIFY_TTL_MS = 5 * 60 * 1000;
const verificationCache = new Map<string, { expiresAt: number; value: ExternalIdentityProof }>();

function inferPlatform(identity: string): string {
  const value = identity.toLowerCase();
  if (value.startsWith('github:') || value.includes('github.com')) return 'github';
  if (value.startsWith('twitter:') || value.startsWith('x:') || value.includes('twitter.com') || value.includes('x.com')) return 'x';
  if (value.startsWith('mastodon:') || value.includes('@')) return 'mastodon';
  if (value.startsWith('telegram:') || value.includes('t.me/')) return 'telegram';
  if (value.startsWith('discord:')) return 'discord';
  if (value.startsWith('website:') || value.startsWith('http://') || value.startsWith('https://')) return 'website';
  return 'other';
}

function parseIdentityEntry(raw: string | string[]): ExternalIdentityProof | null {
  const values = Array.isArray(raw) ? raw : [raw];
  if (!values.length || !values[0]) return null;

  const identity = `${values[0]}`.trim();
  if (!identity) return null;

  return {
    platform: inferPlatform(identity),
    identity,
    proof: values[1] ? `${values[1]}` : undefined,
    claim: values[2] ? `${values[2]}` : undefined,
    verified: false,
    verificationStatus: 'unverified',
  };
}

function toHttpUrl(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  return undefined;
}

function extractHandle(identity: string, platform: 'github' | 'x'): string {
  const normalized = identity.trim();
  if (platform === 'github') {
    return normalized
      .replace(/^github:/i, '')
      .replace(/^https?:\/\/github.com\//i, '')
      .replace(/^@/, '')
      .replace(/\/$/, '');
  }

  return normalized
    .replace(/^(twitter|x):/i, '')
    .replace(/^https?:\/\/(x|twitter)\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/$/, '');
}

function cacheKey(item: ExternalIdentityProof): string {
  return [item.platform, item.identity, item.proof || '', item.claim || ''].join('|');
}

export function parseNip39Identities(profile: NostrProfileLike | null | undefined): ExternalIdentityProof[] {
  if (!profile) return [];

  const fromI = (profile.i || []).map(parseIdentityEntry).filter(Boolean) as ExternalIdentityProof[];
  const fromTags = (profile.tags || [])
    .filter((tag) => tag[0] === 'i')
    .map((tag) => parseIdentityEntry(tag.slice(1)))
    .filter(Boolean) as ExternalIdentityProof[];

  const merged = [...fromI, ...fromTags];
  const dedup = new Map<string, ExternalIdentityProof>();

  for (const item of merged) {
    const key = `${item.platform}:${item.identity}`;
    if (!dedup.has(key)) dedup.set(key, item);
  }

  return Array.from(dedup.values());
}

async function verifyGithubIdentity(item: ExternalIdentityProof): Promise<ExternalIdentityProof> {
  const handle = extractHandle(item.identity, 'github');
  if (!handle) return { ...item, verified: false, verificationStatus: 'failed', error: 'Missing GitHub handle' };

  const userResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (userResponse.status === 404) return { ...item, verified: false, verificationStatus: 'failed', error: 'GitHub user not found' };
  if (userResponse.status !== 200) return { ...item, verified: false, verificationStatus: 'stale', error: `GitHub check unavailable (${userResponse.status})` };

  const user = await userResponse.json() as { login: string; public_repos: number; followers: number; html_url: string };

  const reposResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}/repos?per_page=10`, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  const languages = new Set<string>();
  if (reposResponse.status === 200) {
    const repos = await reposResponse.json() as Array<{ language?: string | null }>;
    repos.forEach((repo) => {
      if (repo.language) languages.add(repo.language);
    });
  }

  const proof = item.proof || '';
  const proofLooksValid = proof.includes(handle) || proof.includes(user.login);

  return {
    ...item,
    verified: proofLooksValid,
    verificationStatus: proofLooksValid ? 'verified' : 'failed',
    error: proofLooksValid ? undefined : 'GitHub proof does not reference identity handle',
    github: {
      login: user.login,
      publicRepos: user.public_repos,
      followers: user.followers,
      languages: Array.from(languages),
      url: user.html_url,
    },
    linkUrl: user.html_url,
  };
}

async function verifyTwitterIdentity(item: ExternalIdentityProof): Promise<ExternalIdentityProof> {
  const handle = extractHandle(item.identity, 'x');
  if (!handle) return { ...item, verified: false, verificationStatus: 'failed', error: 'Missing X/Twitter handle' };

  const profileUrl = `https://x.com/${handle}`;
  const proofUrl = toHttpUrl(item.proof);

  if (!proofUrl) {
    return {
      ...item,
      verified: false,
      verificationStatus: 'failed',
      error: 'Missing X/Twitter proof URL',
      twitter: { handle, profileUrl },
      linkUrl: profileUrl,
    };
  }

  const validHost = /https?:\/\/(x|twitter)\.com\//i.test(proofUrl);
  const referencesHandle = proofUrl.toLowerCase().includes(`/${handle.toLowerCase()}/status/`);

  return {
    ...item,
    verified: validHost && referencesHandle,
    verificationStatus: validHost && referencesHandle ? 'verified' : 'failed',
    error: validHost && referencesHandle ? undefined : 'Proof URL must be an x.com/twitter.com status URL posted by this handle',
    twitter: { handle, profileUrl, proofUrl },
    linkUrl: profileUrl,
  };
}

function verifyGenericIdentity(item: ExternalIdentityProof): ExternalIdentityProof {
  const linkUrl = toHttpUrl(item.proof) || toHttpUrl(item.identity);
  return {
    ...item,
    verified: Boolean(item.proof),
    verificationStatus: item.proof ? 'unverified' : 'failed',
    error: item.proof ? undefined : 'No proof reference provided',
    linkUrl,
  };
}

export async function verifyExternalIdentity(item: ExternalIdentityProof): Promise<ExternalIdentityProof> {
  const key = cacheKey(item);
  const cached = verificationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.value, verificationStatus: cached.value.verificationStatus };
  }

  try {
    const result = item.platform === 'github'
      ? await verifyGithubIdentity(item)
      : item.platform === 'x'
        ? await verifyTwitterIdentity(item)
        : verifyGenericIdentity(item);

    const withTimestamp = {
      ...result,
      verifiedAt: new Date().toISOString(),
    };

    verificationCache.set(key, { expiresAt: Date.now() + VERIFY_TTL_MS, value: withTimestamp });
    return withTimestamp;
  } catch {
    return {
      ...item,
      verified: false,
      verificationStatus: 'stale',
      error: 'Identity verification request failed',
      verifiedAt: new Date().toISOString(),
    };
  }
}

export function buildIdentityProofGuidance(item: ExternalIdentityProof): string {
  if (item.platform === 'github') {
    return `Post a public GitHub gist or profile README line containing: "Verifying Nostr identity ${item.identity}" and paste the URL as proof.`;
  }
  if (item.platform === 'x') {
    return `Post a tweet from ${item.identity} containing "#nostr ${item.identity}" and add that status URL as proof.`;
  }
  return 'Add a publicly accessible URL that references your Nostr identity and platform account.';
}

export function useExternalIdentities(profile: NostrProfileLike | null | undefined) {
  const parsed = useMemo(() => parseNip39Identities(profile), [profile]);
  const [identities, setIdentities] = useState<ExternalIdentityProof[]>(parsed);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    setIdentities(parsed);
  }, [parsed]);

  const verifyAll = async () => {
    if (!identities.length) return;

    setIsVerifying(true);
    try {
      const results = await Promise.all(identities.map((item) => verifyExternalIdentity(item)));
      setIdentities(results);
    } finally {
      setIsVerifying(false);
    }
  };

  const upsertIdentity = (next: Pick<ExternalIdentityProof, 'platform' | 'identity' | 'proof' | 'claim'>) => {
    const normalized = {
      platform: next.platform,
      identity: next.identity,
      proof: next.proof,
      claim: next.claim,
      verified: false,
      verificationStatus: 'unverified' as ExternalIdentityStatus,
    };
    setIdentities((prev) => {
      const idx = prev.findIndex((item) => item.identity === normalized.identity);
      if (idx === -1) return [...prev, normalized];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...normalized };
      return copy;
    });
  };

  return {
    identities,
    isVerifying,
    verifyAll,
    upsertIdentity,
    buildIdentityProofGuidance,
  };
}
