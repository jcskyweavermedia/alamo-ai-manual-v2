import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the Forms list page.
 * Shows 4 placeholder cards in the same grid layout as the real cards.
 */
export function FormsGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Search bar skeleton */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Grid skeleton — matches grid-cols-1 sm:grid-cols-2 gap-4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col p-5 bg-card rounded-[20px] border border-black/[0.04] dark:border-white/[0.06] shadow-card"
          >
            {/* Icon tile + pin area */}
            <div className="flex items-start justify-between mb-4">
              <Skeleton className="w-12 h-12 rounded-[12px]" />
              <Skeleton className="w-8 h-8 rounded-full" />
            </div>
            {/* Title */}
            <Skeleton className="h-5 w-3/4 mb-2" />
            {/* Description lines */}
            <Skeleton className="h-3.5 w-full mb-1.5" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
