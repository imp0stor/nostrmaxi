import { Shield } from 'lucide-react';

interface WotScoreBadgeProps {
  score: number;
  compact?: boolean;
  showLabel?: boolean;
}

export function WotScoreBadge({ score, compact = false, showLabel = true }: WotScoreBadgeProps) {
  const getTrustLevel = (trustScore: number): { label: string; bgColor: string; textColor: string } => {
    if (trustScore >= 80) return { label: 'Highly Trusted', bgColor: 'bg-green-900/30', textColor: 'text-green-400' };
    if (trustScore >= 50) return { label: 'Trusted', bgColor: 'bg-blue-900/30', textColor: 'text-blue-400' };
    if (trustScore >= 20) return { label: 'Moderate', bgColor: 'bg-yellow-900/30', textColor: 'text-yellow-400' };
    return { label: 'Low Trust', bgColor: 'bg-red-900/30', textColor: 'text-red-400' };
  };

  const trust = getTrustLevel(score);

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-1 ${trust.bgColor} rounded`} title={trust.label}>
        <Shield className={`w-3 h-3 ${trust.textColor}`} />
        <span className={`text-xs font-semibold ${trust.textColor}`}>{score}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className={`inline-flex items-center gap-2 px-3 py-2 ${trust.bgColor} rounded-lg`}>
        <Shield className={`w-5 h-5 ${trust.textColor}`} />
        <div>
          <div className={`text-xl font-bold ${trust.textColor}`}>{score}</div>
          {showLabel && <div className={`text-xs ${trust.textColor}`}>{trust.label}</div>}
        </div>
      </div>
    </div>
  );
}
