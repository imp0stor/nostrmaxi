import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useSharedUI } from '../../../../../shared-ui/feature-flags';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime?: number;
  lastChecked: string;
  message?: string;
}

interface SystemHealth {
  api: ServiceHealth;
  database: ServiceHealth;
  lnbits: ServiceHealth;
  wot: ServiceHealth;
  overall: 'healthy' | 'degraded' | 'down';
}

export function ServiceHealthCard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { enabled: sharedUiEnabled } = useSharedUI();

  useEffect(() => {
    checkHealth();

    if (autoRefresh) {
      const interval = setInterval(checkHealth, 30000); // Check every 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const checkHealth = async () => {
    try {
      const response = await api.getHealth();
      
      setHealth({
        api: {
          name: 'API Server',
          status: 'healthy',
          responseTime: response.responseTime || 0,
          lastChecked: new Date().toISOString(),
        },
        database: {
          name: 'PostgreSQL',
          status: response.database === 'connected' ? 'healthy' : 'down',
          lastChecked: new Date().toISOString(),
        },
        lnbits: {
          name: 'LNbits Payment',
          status: response.lnbits === 'connected' ? 'healthy' : 'degraded',
          lastChecked: new Date().toISOString(),
          message: response.lnbitsMessage,
        },
        wot: {
          name: 'WoT Service',
          status: response.wot === 'ready' ? 'healthy' : 'degraded',
          lastChecked: new Date().toISOString(),
          message: response.wotMode === 'mock' ? 'Using mock data' : 'Live relays active',
        },
        overall: 'healthy',
      });
    } catch (err) {
      // Fallback to mock data if health endpoint fails
      setHealth({
        api: {
          name: 'API Server',
          status: 'unknown',
          lastChecked: new Date().toISOString(),
          message: 'Unable to reach health endpoint',
        },
        database: {
          name: 'PostgreSQL',
          status: 'unknown',
          lastChecked: new Date().toISOString(),
        },
        lnbits: {
          name: 'LNbits Payment',
          status: 'unknown',
          lastChecked: new Date().toISOString(),
        },
        wot: {
          name: 'WoT Service',
          status: 'degraded',
          lastChecked: new Date().toISOString(),
          message: 'Mock mode (demo)',
        },
        overall: 'degraded',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-400';
      case 'degraded':
        return 'bg-yellow-400';
      case 'down':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'active';
      case 'degraded':
        return 'pending';
      case 'down':
        return 'error';
      case 'unknown':
        return 'info';
      default:
        return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Healthy';
      case 'degraded':
        return 'Degraded';
      case 'down':
        return 'Down';
      default:
        return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="ui-card">
        <h3 className="text-lg font-semibold text-white mb-4">Service Health</h3>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-nostr-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!health) return null;

  const allServices = [health.api, health.database, health.lnbits, health.wot];
  const healthyCount = allServices.filter((s) => s.status === 'healthy').length;

  return (
    <div className="ui-card space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Service Health</h3>
          <p className="ui-muted text-sm">
            {healthyCount}/{allServices.length} services operational
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="text-sm ui-muted hover:text-white"
        >
          {autoRefresh ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Live</span>
            </div>
          ) : (
            'Paused'
          )}
        </button>
      </div>

      {/* Overall status indicator */}
      <div
        className={`rounded-lg p-4 border ${
          health.overall === 'healthy'
            ? 'bg-green-500/10 border-green-500/30'
            : health.overall === 'degraded'
            ? 'bg-yellow-500/10 border-yellow-500/30'
            : 'bg-red-500/10 border-red-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${getStatusColor(health.overall)}`} />
          <div>
            <p className="font-semibold text-white">
              {health.overall === 'healthy'
                ? '✓ All Systems Operational'
                : health.overall === 'degraded'
                ? '⚠ Partial Degradation'
                : '❌ Service Disruption'}
            </p>
            {health.api.responseTime && (
              <p className="text-xs text-gray-400 mt-1">
                API response time: {health.api.responseTime}ms
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Service list */}
      <div className="space-y-3">
        {allServices.map((service) => (
          <div
            key={service.name}
            className="flex items-center justify-between p-3 bg-nostr-darker rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(service.status)}`} />
              <div>
                <p className="text-white font-medium text-sm">{service.name}</p>
                {service.message && (
                  <p className="text-xs text-gray-400 mt-0.5">{service.message}</p>
                )}
              </div>
            </div>
            {sharedUiEnabled ? (
              <span className="ui-status" data-variant={getStatusVariant(service.status)}>
                {getStatusLabel(service.status)}
              </span>
            ) : (
              <span className="text-xs uppercase tracking-wide ui-muted">
                {getStatusLabel(service.status)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={checkHealth} className="ui-button flex-1 text-sm">
          Refresh Status
        </button>
        <button
          onClick={() => window.open('/api/health', '_blank')}
          className="ui-button text-sm"
        >
          View Raw
        </button>
      </div>

      {/* Last checked timestamp */}
      <div className="text-center text-xs text-gray-500">
        Last checked: {new Date(health.api.lastChecked).toLocaleTimeString()}
      </div>
    </div>
  );
}
