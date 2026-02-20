import { useEffect, useState } from 'react';

interface HealthResponse {
  status: 'healthy' | 'degraded' | string;
  timestamp: string;
  version: string;
  services?: {
    database?: string;
  };
}

export function ServiceStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: HealthResponse = await response.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach service');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const statusColor = health?.status === 'healthy' ? 'text-green-400' : 'text-yellow-400';

  return (
    <div className="bg-nostr-dark rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Service Status</h3>
        <button
          onClick={fetchHealth}
          className="text-sm text-gray-400 hover:text-white"
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-4 h-4 border-2 border-nostr-purple border-t-transparent rounded-full animate-spin" />
          Checking status...
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm">
          Failed to load health check: {error}
        </div>
      ) : health ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Overall</span>
            <span className={`font-semibold ${statusColor}`}>
              {health.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Database</span>
            <span className={health.services?.database === 'up' ? 'text-green-400' : 'text-red-400'}>
              {health.services?.database || 'unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Version</span>
            <span className="text-gray-300">{health.version}</span>
          </div>
          <div className="text-xs text-gray-500">
            Last checked {new Date(health.timestamp).toLocaleString()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
