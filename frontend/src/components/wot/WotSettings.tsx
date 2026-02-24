import { useState } from 'react';
import { Save, RotateCcw, Info } from 'lucide-react';

interface WotSettingsProps {
  onSave?: (settings: WotUserSettings) => Promise<void>;
}

export interface WotUserSettings {
  filterMode: 'firehose' | 'genuine' | 'wot';
  wotDepth: number;
  hideBotsAutomatically: boolean;
  minTrustScore: number;
  showBotIndicators: boolean;
  enableWotDiscounts: boolean;
}

const DEFAULT_SETTINGS: WotUserSettings = {
  filterMode: 'genuine',
  wotDepth: 2,
  hideBotsAutomatically: true,
  minTrustScore: 20,
  showBotIndicators: true,
  enableWotDiscounts: true,
};

export function WotSettings({ onSave }: WotSettingsProps) {
  const [settings, setSettings] = useState<WotUserSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave?.(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save settings',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setMessage(null);
  };

  const isChanged = JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Web of Trust Settings</h2>
        <p className="text-gray-400">
          Customize how the Web of Trust affects your feed and experience.
        </p>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-900/20 border-green-800 text-green-300'
              : 'bg-red-900/20 border-red-800 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Settings */}
      <div className="bg-nostr-darker border border-gray-800 rounded-lg p-6 space-y-6">
        {/* Filter Mode */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-lg font-semibold text-white">Content Filter Mode</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-500 cursor-help" />
              <div className="opacity-0 group-hover:opacity-100 absolute left-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 p-2 z-10 transition-opacity pointer-events-none">
                Choose how strictly to filter content based on trust scores.
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {[
              { id: 'firehose', label: 'All Content', description: 'See everything, no filtering' },
              { id: 'genuine', label: 'Genuine Only', description: 'Filter out likely bots' },
              { id: 'wot', label: 'Web of Trust', description: 'Only content from trusted network' },
            ].map((option) => (
              <label key={option.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
                <input
                  type="radio"
                  name="filterMode"
                  value={option.id}
                  checked={settings.filterMode === option.id}
                  onChange={(e) =>
                    setSettings(prev => ({ ...prev, filterMode: e.target.value as any }))
                  }
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-semibold text-white">{option.label}</div>
                  <div className="text-sm text-gray-400">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* WoT Depth */}
        {settings.filterMode === 'wot' && (
          <div className="pt-6 border-t border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <label className="text-lg font-semibold text-white">Trust Network Depth</label>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-500 cursor-help" />
                <div className="opacity-0 group-hover:opacity-100 absolute left-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 p-2 z-10 transition-opacity pointer-events-none">
                  How many degrees of separation to include in your trust network.
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={settings.wotDepth}
                  onChange={(e) =>
                    setSettings(prev => ({ ...prev, wotDepth: parseInt(e.target.value) }))
                  }
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-lg font-bold text-nostr-purple min-w-fit">{settings.wotDepth}</span>
              </div>
              <p className="text-sm text-gray-400">
                {settings.wotDepth === 1 && 'Include direct follows only'}
                {settings.wotDepth === 2 && 'Include follows of follows'}
                {settings.wotDepth === 3 && 'Include 3rd degree connections'}
                {settings.wotDepth === 4 && 'Include 4th degree connections'}
                {settings.wotDepth === 5 && 'Include extended network'}
              </p>
            </div>
          </div>
        )}

        {/* Minimum Trust Score */}
        <div className="pt-6 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <label className="text-lg font-semibold text-white">Minimum Trust Score</label>
            <div className="group relative">
              <Info className="w-4 h-4 text-gray-500 cursor-help" />
              <div className="opacity-0 group-hover:opacity-100 absolute left-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 p-2 z-10 transition-opacity pointer-events-none">
                Hide content from accounts with trust scores below this threshold.
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={settings.minTrustScore}
                onChange={(e) =>
                  setSettings(prev => ({ ...prev, minTrustScore: parseInt(e.target.value) }))
                }
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-lg font-bold text-nostr-purple min-w-fit">{settings.minTrustScore}</span>
            </div>
            <p className="text-sm text-gray-400">
              Accounts with scores {settings.minTrustScore}+ will be shown
            </p>
          </div>
        </div>

        {/* Bot Detection */}
        <div className="pt-6 border-t border-gray-700 space-y-3">
          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={settings.hideBotsAutomatically}
              onChange={(e) =>
                setSettings(prev => ({ ...prev, hideBotsAutomatically: e.target.checked }))
              }
              className="w-4 h-4"
            />
            <div>
              <div className="font-semibold text-white">Hide likely bots automatically</div>
              <div className="text-sm text-gray-400">Don't show content from accounts likely to be bots</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={settings.showBotIndicators}
              onChange={(e) =>
                setSettings(prev => ({ ...prev, showBotIndicators: e.target.checked }))
              }
              className="w-4 h-4"
            />
            <div>
              <div className="font-semibold text-white">Show bot indicators</div>
              <div className="text-sm text-gray-400">Display badges when content might be from a bot</div>
            </div>
          </label>
        </div>

        {/* WoT Discounts */}
        <div className="pt-6 border-t border-gray-700">
          <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={settings.enableWotDiscounts}
              onChange={(e) =>
                setSettings(prev => ({ ...prev, enableWotDiscounts: e.target.checked }))
              }
              className="w-4 h-4"
            />
            <div>
              <div className="font-semibold text-white">Enable Web of Trust discounts</div>
              <div className="text-sm text-gray-400">Allow your trust score to qualify for subscription discounts</div>
            </div>
          </label>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-300 mb-2">About Web of Trust</h4>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• Your trust score is calculated based on your network activity and followers</li>
          <li>• Higher trust scores give you access to better discounts and community benefits</li>
          <li>• These settings only affect your view - they don't change what's published</li>
          <li>• Bot detection is based on behavioral analysis and account patterns</li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={!isChanged || saving}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors ${
            isChanged && !saving
              ? 'bg-nostr-purple hover:bg-nostr-purple/80 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {isChanged && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-gray-800 hover:bg-gray-700 text-white transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-5 h-5" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
