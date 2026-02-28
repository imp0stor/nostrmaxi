import { api } from './api';

const RUNTIME_CONFIG_CACHE_KEY = 'nostrmaxi.runtime.config';

type ConfigMap = Record<string, unknown>;

let inMemoryConfig: ConfigMap = {};

export function getCachedConfigValue<T>(key: string, fallback: T): T {
  if (Object.prototype.hasOwnProperty.call(inMemoryConfig, key)) {
    return inMemoryConfig[key] as T;
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(RUNTIME_CONFIG_CACHE_KEY);
      if (raw) {
        inMemoryConfig = JSON.parse(raw) as ConfigMap;
      }
    } catch {
      // noop
    }
  }

  return (Object.prototype.hasOwnProperty.call(inMemoryConfig, key) ? inMemoryConfig[key] : fallback) as T;
}

export async function refreshRuntimeConfig(): Promise<ConfigMap> {
  const entries = await apiRequestConfig();
  const map: ConfigMap = {};

  for (const entry of entries) {
    map[entry.key] = entry.value;
  }

  inMemoryConfig = map;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(RUNTIME_CONFIG_CACHE_KEY, JSON.stringify(map));
  }

  return map;
}

export async function getRuntimeConfigValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const map = await refreshRuntimeConfig();
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      return map[key] as T;
    }
  } catch {
    // use cache/fallback
  }

  return getCachedConfigValue(key, fallback);
}

async function apiRequestConfig(): Promise<Array<{ key: string; value: unknown }>> {
  const token = api.getToken();
  const response = await fetch('/api/v1/admin/config', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error(`Config fetch failed: ${response.status}`);
  }

  return response.json() as Promise<Array<{ key: string; value: unknown }>>;
}
