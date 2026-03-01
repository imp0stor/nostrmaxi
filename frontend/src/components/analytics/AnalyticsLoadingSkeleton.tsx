interface AnalyticsLoadingSkeletonProps {
  progressPercent?: number;
  progressStatus?: string;
}

export function AnalyticsLoadingSkeleton({ progressPercent, progressStatus }: AnalyticsLoadingSkeletonProps) {
  const hasProgress = typeof progressPercent === 'number';

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-gray-700 rounded" />
      {hasProgress ? (
        <section className="cy-card p-4 space-y-2 not-animate-pulse">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>{progressStatus || 'Loading analytics…'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div
            role="progressbar"
            aria-label="Analytics loading progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-valuetext={progressStatus || 'Loading analytics'}
            className="h-2 rounded bg-gray-800 overflow-hidden"
          >
            <div
              className="h-2 bg-cyan-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="cy-card p-4 h-28">
            <div className="h-6 w-6 bg-gray-700 rounded mb-2" />
            <div className="h-8 w-24 bg-gray-700 rounded mb-1" />
            <div className="h-4 w-16 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      <div className="cy-card p-5 h-64">
        <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
        <div className="h-48 bg-gray-800 rounded" />
      </div>
    </div>
  );
}
