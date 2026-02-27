/**
 * Beacon Search Integration
 * 
 * Client for querying the backend /api/v1/search endpoint,
 * which integrates with Beacon search service.
 */

import type { NostrProfile } from '../types';

export interface BeaconSearchResult {
  pubkey: string;
  npub: string;
  name?: string;
  nip05?: string;
  about?: string;
  picture?: string;
  score?: number;
  profile?: NostrProfile;
}

export interface BeaconSearchResponse {
  results: BeaconSearchResult[];
  total: number;
  source: 'beacon' | 'cache' | 'fallback';
  beaconAvailable: boolean;
  query: string;
  timestamp: string;
}

export interface BeaconSearchParams {
  query: string;
  limit?: number;
  offset?: number;
}

const API_BASE = '/api/v1';

/**
 * Search for Nostr profiles using Beacon
 */
export async function searchProfiles(params: BeaconSearchParams): Promise<BeaconSearchResponse> {
  const { query, limit = 20, offset = 0 } = params;
  
  if (!query.trim()) {
    return {
      results: [],
      total: 0,
      source: 'fallback',
      beaconAvailable: false,
      query: '',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const url = new URL(`${API_BASE}/search`, window.location.origin);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}`);
    }

    const data = await response.json();
    return data as BeaconSearchResponse;
  } catch (error) {
    console.error('Beacon search failed:', error);
    
    // Return empty results on error
    return {
      results: [],
      total: 0,
      source: 'fallback',
      beaconAvailable: false,
      query,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Debounced search hook
 */
export function useBeaconSearch(query: string, debounceMs: number = 300) {
  const [results, setResults] = React.useState<BeaconSearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const data = await searchProfiles({ query });
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Search failed'));
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return { results, loading, error };
}

// React import helper (top-level for hook)
import React from 'react';
