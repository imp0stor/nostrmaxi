import { AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';

interface BotIndicatorProps {
  isLikelyBot: boolean;
  confidence?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showTooltip?: boolean;
}

export function BotIndicator({
  isLikelyBot,
  confidence = 0.85,
  size = 'md',
  showLabel = true,
  showTooltip = true,
}: BotIndicatorProps) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const labelSizeMap = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const tooltipText = isLikelyBot
    ? `This account appears to be a bot (${Math.round(confidence * 100)}% confidence).`
    : 'This account appears to be human-operated.';

  return (
    <div className="relative group inline-flex items-center gap-2">
      {isLikelyBot ? (
        <div className="flex items-center gap-1">
          <AlertTriangle className={`${sizeMap[size]} text-red-500 flex-shrink-0`} />
          {showLabel && (
            <span className={`${labelSizeMap[size]} font-semibold text-red-500`}>
              Possible Bot
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <CheckCircle className={`${sizeMap[size]} text-green-500 flex-shrink-0`} />
          {showLabel && (
            <span className={`${labelSizeMap[size]} font-semibold text-green-500`}>
              Human
            </span>
          )}
        </div>
      )}

      {showTooltip && (
        <div className="opacity-0 group-hover:opacity-100 absolute left-0 bottom-full mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300 whitespace-nowrap z-10 transition-opacity pointer-events-none">
          {tooltipText}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

interface BotDetectionCardProps {
  isLikelyBot: boolean;
  confidence?: number;
  reasons?: string[];
  publicKey?: string;
}

export function BotDetectionCard({
  isLikelyBot,
  confidence = 0.85,
  reasons = [],
  publicKey,
}: BotDetectionCardProps) {
  const defaultReasons = isLikelyBot
    ? [
        'High follower acquisition rate',
        'Repetitive posting patterns',
        'Unusual interaction timing',
        'Generic profile information',
      ]
    : [
        'Natural interaction patterns',
        'Diverse engagement activity',
        'Regular posting schedule',
        'Detailed profile setup',
      ];

  const displayReasons = reasons.length > 0 ? reasons : defaultReasons;

  return (
    <div
      className={`rounded-lg border-2 p-6 ${
        isLikelyBot
          ? 'bg-red-900/10 border-red-800'
          : 'bg-green-900/10 border-green-800'
      }`}
    >
      <div className="flex items-center gap-4 mb-4">
        {isLikelyBot ? (
          <div className="flex items-center justify-center w-12 h-12 bg-red-900/30 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
        ) : (
          <div className="flex items-center justify-center w-12 h-12 bg-green-900/30 rounded-lg">
            <CheckCircle className="w-6 h-6 text-green-500" />
          </div>
        )}

        <div className="flex-1">
          <h3
            className={`text-lg font-bold ${
              isLikelyBot ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {isLikelyBot ? 'Likely Bot Account' : 'Likely Human Account'}
          </h3>
          <p
            className={`text-sm ${
              isLikelyBot ? 'text-red-300' : 'text-green-300'
            }`}
          >
            Confidence: {Math.round(confidence * 100)}%
          </p>
        </div>
      </div>

      {/* Confidence meter */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-400">Detection confidence</span>
          <span
            className={`text-sm font-bold ${
              isLikelyBot ? 'text-red-400' : 'text-green-400'
            }`}
          >
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all ${
              isLikelyBot ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Detection reasons */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-white mb-3">Detection factors:</h4>
        <ul className="space-y-2">
          {displayReasons.map((reason, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-gray-300">
              <div
                className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isLikelyBot ? 'bg-red-500' : 'bg-green-500'
                }`}
              />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      {/* Additional info */}
      <div
        className={`p-3 rounded-lg flex gap-2 ${
          isLikelyBot
            ? 'bg-red-900/20 border border-red-800'
            : 'bg-green-900/20 border border-green-800'
        }`}
      >
        <HelpCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isLikelyBot ? 'text-red-400' : 'text-green-400'}`} />
        <p className={`text-xs ${isLikelyBot ? 'text-red-300' : 'text-green-300'}`}>
          {isLikelyBot
            ? 'Accounts flagged as likely bots may have limited visibility in community feeds and may not be eligible for trust-based discounts.'
            : 'This account appears to be human-operated and may be eligible for Web of Trust benefits and community visibility.'}
        </p>
      </div>

      {publicKey && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Pubkey: {publicKey.slice(0, 8)}...{publicKey.slice(-8)}
          </p>
        </div>
      )}
    </div>
  );
}
