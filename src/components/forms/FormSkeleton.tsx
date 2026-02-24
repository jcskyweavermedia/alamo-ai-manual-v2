import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the Form detail/fill page.
 * Shows a placeholder header, progress bar, and 4 field skeletons.
 */
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Progress bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-1.5 flex-1 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>

      {/* Section header skeleton */}
      <div className="flex items-center gap-3 pt-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex-1 border-t border-border/40" />
      </div>

      {/* Field skeletons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}

      {/* Footer skeleton */}
      <div className="flex gap-3 pt-4">
        <Skeleton className="h-11 flex-1 rounded-lg" />
        <Skeleton className="h-11 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
