import { Shield, Users, TrendingUp } from 'lucide-react';

interface WotDepthLevel {
  depth: number;
  label: string;
  description: string;
  color: string;
}

interface WotDepthVisualizationProps {
  currentDepth: number;
  maxDepth?: number;
  onDepthChange?: (depth: number) => void;
}

const DEPTH_LEVELS: WotDepthLevel[] = [
  {
    depth: 0,
    label: 'Self',
    description: 'You',
    color: 'border-nostr-purple bg-nostr-purple/10',
  },
  {
    depth: 1,
    label: 'Direct',
    description: 'People you follow',
    color: 'border-blue-500 bg-blue-500/10',
  },
  {
    depth: 2,
    label: 'Secondary',
    description: 'Follows of people you follow',
    color: 'border-green-500 bg-green-500/10',
  },
  {
    depth: 3,
    label: 'Tertiary',
    description: '3rd degree network',
    color: 'border-yellow-500 bg-yellow-500/10',
  },
  {
    depth: 4,
    label: 'Quaternary',
    description: '4th degree network',
    color: 'border-orange-500 bg-orange-500/10',
  },
  {
    depth: 5,
    label: 'Extended',
    description: '5th degree network',
    color: 'border-red-500 bg-red-500/10',
  },
];

export function WotDepthVisualization({
  currentDepth,
  onDepthChange,
}: WotDepthVisualizationProps) {
  return (
    <div className="space-y-6">
      {/* Visual Network Graph */}
      <div className="bg-nostr-darker rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-6">Web of Trust Depth</h3>

        {/* Concentric circles visualization */}
        <div className="flex items-center justify-center mb-8 h-64">
          <svg viewBox="0 0 400 400" className="w-full h-full max-w-xs">
            {/* Background circles */}
            {[5, 4, 3, 2, 1].map((depth) => (
              <circle
                key={`bg-${depth}`}
                cx="200"
                cy="200"
                r={200 - depth * 30}
                fill={currentDepth >= depth ? 'rgba(168, 85, 247, 0.05)' : 'rgba(100, 100, 100, 0.05)'}
                stroke={currentDepth >= depth ? 'rgba(168, 85, 247, 0.3)' : 'rgba(100, 100, 100, 0.2)'}
                strokeWidth="1"
              />
            ))}

            {/* Self (center) */}
            <circle cx="200" cy="200" r="20" fill="url(#gradientPurple)" />
            <text x="200" y="205" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
              YOU
            </text>

            {/* Ring labels */}
            {[1, 2, 3, 4, 5].map((depth) => (
              <g key={`label-${depth}`}>
                <text
                  x="200"
                  y={70 + depth * 30}
                  textAnchor="middle"
                  fill="#999"
                  fontSize="11"
                  opacity={currentDepth >= depth ? 1 : 0.5}
                >
                  {DEPTH_LEVELS[depth].label}
                </text>
              </g>
            ))}

            {/* Gradient definitions */}
            <defs>
              <linearGradient id="gradientPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Depth legend */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          {DEPTH_LEVELS.map((level) => (
            <div
              key={level.depth}
              className={`p-3 rounded-lg border-2 transition-all cursor-pointer ${
                currentDepth === level.depth ? level.color + ' border-opacity-100' : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
              }`}
              onClick={() => onDepthChange?.(level.depth)}
            >
              <div className="font-semibold text-sm text-white">{level.label}</div>
              <div className="text-xs text-gray-400 line-clamp-1">{level.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800 text-center">
          <Users className="w-6 h-6 text-nostr-purple mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">2.4K</div>
          <div className="text-xs text-gray-400">Connected users</div>
        </div>
        <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800 text-center">
          <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">85%</div>
          <div className="text-xs text-gray-400">Trust score</div>
        </div>
        <div className="bg-nostr-darker rounded-lg p-4 border border-gray-800 text-center">
          <Shield className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <div className="text-2xl font-bold text-white">{currentDepth}</div>
          <div className="text-xs text-gray-400">Current depth</div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-300 mb-2">How Web of Trust Works</h4>
        <ul className="text-sm text-blue-200 space-y-1">
          <li>• <strong>Depth 0:</strong> You - your own account</li>
          <li>• <strong>Depth 1:</strong> People you follow directly</li>
          <li>• <strong>Depth 2:</strong> Friends of your friends</li>
          <li>• <strong>Depth 3-5:</strong> Extended network connections</li>
          <li>• Lower depths generally = more trustworthy</li>
          <li>• Trust scores influence content visibility and discounts</li>
        </ul>
      </div>
    </div>
  );
}
