import type { NostrEvent } from '../types';

export interface BlossomServer {
  url: string;
  name: string;
  priority: number;
  requiresAuth: boolean;
}

export interface BlossomUploadResult {
  url: string;
  sha256: string;
  size: number;
  type: string;
  server: string;
}

export type SignEventFn = (event: Omit<NostrEvent, 'id' | 'sig'>) => Promise<NostrEvent | null>;

export interface BlossomConfig {
  servers: BlossomServer[];
  preferredServer: string | null;
  maxFileSize: number;
  allowedTypes: string[];
}

const BLOSSOM_CONFIG_KEY = 'nostrmaxi.blossom.config';

export const BLOSSOM_SERVERS: BlossomServer[] = [
  { url: 'https://blossom.primal.net', name: 'Primal', priority: 1, requiresAuth: false },
  { url: 'https://nostr.build', name: 'nostr.build', priority: 2, requiresAuth: false },
  { url: 'https://void.cat', name: 'void.cat', priority: 3, requiresAuth: false },
  { url: 'https://nostrimg.com', name: 'nostrimg', priority: 4, requiresAuth: false },
];

const DEFAULT_CONFIG: BlossomConfig = {
  servers: BLOSSOM_SERVERS,
  preferredServer: BLOSSOM_SERVERS[0]?.url ?? null,
  maxFileSize: 50 * 1024 * 1024,
  allowedTypes: ['image/', 'video/', 'audio/'],
};

const cleanServerUrl = (url: string) => url.replace(/\/+$/, '');

const sortServers = (servers: BlossomServer[]) => [...servers].sort((a, b) => a.priority - b.priority);

export function getBlossomConfig(): BlossomConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(BLOSSOM_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<BlossomConfig>;
    return {
      servers: Array.isArray(parsed.servers) && parsed.servers.length > 0 ? sortServers(parsed.servers) : DEFAULT_CONFIG.servers,
      preferredServer: typeof parsed.preferredServer === 'string' || parsed.preferredServer === null ? parsed.preferredServer : DEFAULT_CONFIG.preferredServer,
      maxFileSize: typeof parsed.maxFileSize === 'number' ? parsed.maxFileSize : DEFAULT_CONFIG.maxFileSize,
      allowedTypes: Array.isArray(parsed.allowedTypes) && parsed.allowedTypes.length > 0 ? parsed.allowedTypes : DEFAULT_CONFIG.allowedTypes,
    };
  } catch (error) {
    console.error('Failed reading Blossom config:', error);
    return DEFAULT_CONFIG;
  }
}

export function setBlossomConfig(config: Partial<BlossomConfig>): void {
  const current = getBlossomConfig();
  const next: BlossomConfig = {
    ...current,
    ...config,
    servers: config.servers ? sortServers(config.servers) : current.servers,
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BLOSSOM_CONFIG_KEY, JSON.stringify(next));
  }
}

export function addBlossomServer(server: BlossomServer): void {
  const current = getBlossomConfig();
  const normalized = { ...server, url: cleanServerUrl(server.url) };
  const withoutDupes = current.servers.filter((s) => cleanServerUrl(s.url) !== normalized.url);
  setBlossomConfig({ servers: [...withoutDupes, normalized] });
}

export function removeBlossomServer(url: string): void {
  const target = cleanServerUrl(url);
  const current = getBlossomConfig();
  const servers = current.servers.filter((s) => cleanServerUrl(s.url) !== target);
  setBlossomConfig({ servers, preferredServer: current.preferredServer === target ? null : current.preferredServer });
}

async function sha256Hex(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

async function createAuthorizationHeader(
  serverUrl: string,
  file: File,
  hash: string,
  signEvent?: SignEventFn,
): Promise<string | null> {
  if (!signEvent) return null;

  const pubkey =
    window.localStorage.getItem('nostrmaxi.auth.pubkey')
    || window.localStorage.getItem('nostrmaxi.pubkey')
    || window.localStorage.getItem('pubkey');

  if (!pubkey) {
    console.warn('Blossom auth required but pubkey was not found in localStorage.');
    return null;
  }

  const uploadUrl = `${cleanServerUrl(serverUrl)}/upload`;
  const unsignedEvent: Omit<NostrEvent, 'id' | 'sig'> = {
    kind: 24242,
    content: '',
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
    tags: [
      ['u', uploadUrl],
      ['method', 'PUT'],
      ['x', hash],
      ['type', file.type || 'application/octet-stream'],
      ['size', String(file.size)],
      ['expiration', String(Math.floor(Date.now() / 1000) + 300)],
    ],
  };

  const signed = await signEvent(unsignedEvent);
  if (!signed) return null;
  return `Nostr ${toBase64(JSON.stringify(signed))}`;
}

async function uploadViaXhr(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress?: (percent: number) => void,
): Promise<any> {
  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } catch {
          resolve({});
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error while uploading media'));
    xhr.send(file);
  });
}

export async function uploadMedia(
  file: File,
  signEvent?: SignEventFn,
  serverOverride?: BlossomServer,
  onProgress?: (percent: number) => void,
): Promise<BlossomUploadResult> {
  const config = getBlossomConfig();
  const server = serverOverride || config.servers.find((s) => cleanServerUrl(s.url) === cleanServerUrl(config.preferredServer || '')) || sortServers(config.servers)[0];

  if (!server) throw new Error('No Blossom servers configured.');
  if (file.size > config.maxFileSize) throw new Error(`File is too large. Max size is ${Math.round(config.maxFileSize / (1024 * 1024))}MB.`);
  if (!config.allowedTypes.some((typePrefix) => file.type.startsWith(typePrefix))) {
    throw new Error('This file type is not allowed in your Blossom settings.');
  }

  const hash = await sha256Hex(file);
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  };

  if (server.requiresAuth) {
    const auth = await createAuthorizationHeader(server.url, file, hash, signEvent);
    if (!auth) throw new Error(`Server ${server.name} requires Nostr authorization.`);
    headers.Authorization = auth;
  }

  const response = await uploadViaXhr(`${cleanServerUrl(server.url)}/upload`, file, headers, onProgress);

  return {
    url: typeof response.url === 'string' && response.url ? response.url : `${cleanServerUrl(server.url)}/${hash}`,
    sha256: response.sha256 || hash,
    size: Number(response.size ?? file.size),
    type: response.type || file.type,
    server: cleanServerUrl(server.url),
  };
}

export async function uploadMediaWithFallback(file: File, signEvent?: SignEventFn, onProgress?: (percent: number) => void): Promise<BlossomUploadResult> {
  const config = getBlossomConfig();
  const ordered = sortServers(config.servers);
  const preferred = config.preferredServer ? ordered.find((s) => cleanServerUrl(s.url) === cleanServerUrl(config.preferredServer || '')) : undefined;
  const queue = preferred ? [preferred, ...ordered.filter((s) => cleanServerUrl(s.url) !== cleanServerUrl(preferred.url))] : ordered;

  const failures: string[] = [];
  for (const server of queue) {
    try {
      return await uploadMedia(file, signEvent, server, onProgress);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      failures.push(`${server.name}: ${message}`);
      console.error(`[Blossom] Upload failed on ${server.url}`, error);
    }
  }

  throw new Error(`Upload failed on all Blossom servers. ${failures.join(' | ')}`);
}

export async function getMediaUrl(sha256: string): Promise<string | null> {
  const servers = sortServers(getBlossomConfig().servers);
  const paths = [`/${sha256}`, `/media/${sha256}`, `/blob/${sha256}`];

  for (const server of servers) {
    for (const path of paths) {
      const candidate = `${cleanServerUrl(server.url)}${path}`;
      try {
        const response = await fetch(candidate, { method: 'HEAD' });
        if (response.ok) return candidate;
      } catch {
        // try next candidate
      }
    }
  }

  return null;
}

export async function deleteMedia(sha256: string, signEvent: SignEventFn): Promise<boolean> {
  const servers = sortServers(getBlossomConfig().servers);
  for (const server of servers) {
    try {
      const fakeFile = new File([], 'delete.bin', { type: 'application/octet-stream' });
      const auth = await createAuthorizationHeader(server.url, fakeFile, sha256, signEvent);
      if (!auth) continue;

      const response = await fetch(`${cleanServerUrl(server.url)}/${sha256}`, {
        method: 'DELETE',
        headers: { Authorization: auth },
      });

      if (response.ok) return true;
    } catch (error) {
      console.error(`[Blossom] Delete failed on ${server.url}`, error);
    }
  }

  return false;
}
