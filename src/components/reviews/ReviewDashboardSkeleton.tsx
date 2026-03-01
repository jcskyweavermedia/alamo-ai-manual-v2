function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-[16px] p-6 animate-pulse ${className}`}>
      <div className="h-4 w-32 bg-muted rounded mb-4" />
      <div className="h-8 w-20 bg-muted rounded mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-3 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
}

function SkeletonChartCard() {
  return (
    <div className="bg-card border border-border rounded-[16px] p-6 animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-2" />
      <div className="h-3 w-24 bg-muted rounded mb-4" />
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-16 bg-muted rounded-full" />
        ))}
      </div>
      <div className="h-[220px] bg-muted rounded-lg" />
    </div>
  );
}

export function ReviewDashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tab bar skeleton */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-full max-w-[420px] bg-muted rounded-full animate-pulse" />
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-32 bg-muted rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3"><SkeletonCard /></div>
        <div className="lg:col-span-3"><SkeletonCard /></div>
        <div className="lg:col-span-6"><SkeletonChartCard /></div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard className="h-[300px]" />
        <SkeletonCard className="h-[300px]" />
      </div>
    </div>
  );
}
