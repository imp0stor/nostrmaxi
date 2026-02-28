import { useEffect, useState } from 'react';
import { getCachedConfigValue, getRuntimeConfigValue } from '../lib/runtimeConfig';

export function useConfig<T>(key: string, defaultValue: T): { value: T; loading: boolean; error: Error | null } {
  const [value, setValue] = useState<T>(getCachedConfigValue<T>(key, defaultValue));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    getRuntimeConfigValue<T>(key, defaultValue)
      .then((resolved) => {
        if (mounted) {
          setValue(resolved);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load config'));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [key, defaultValue]);

  return { value, loading, error };
}
