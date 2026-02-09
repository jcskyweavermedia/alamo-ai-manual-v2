/**
 * ManualBreadcrumb
 * 
 * Shows current location in manual hierarchy for easy back navigation.
 * Truncates middle items on mobile when path is too long.
 */

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  id: string;
  title: string;
}

export interface ManualBreadcrumbProps {
  /** Ancestors from root to current (not including current) */
  ancestors: BreadcrumbItem[];
  /** Current section */
  current?: BreadcrumbItem;
  /** Called when an ancestor is clicked */
  onNavigate?: (id: string) => void;
  className?: string;
}

export function ManualBreadcrumb({
  ancestors,
  current,
  onNavigate,
  className,
}: ManualBreadcrumbProps) {
  if (ancestors.length === 0 && !current) {
    return null;
  }

  // For mobile: if more than 2 ancestors, show first + ellipsis + last
  const shouldTruncate = ancestors.length > 2;
  const visibleAncestors = shouldTruncate
    ? [ancestors[0], { id: '__ellipsis__', title: '...' }, ancestors[ancestors.length - 1]]
    : ancestors;

  return (
    <nav
      className={cn("flex items-center gap-1 text-caption text-muted-foreground flex-wrap", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-1 flex-wrap">
        {visibleAncestors.map((ancestor, index) => (
          <li key={ancestor.id} className="flex items-center gap-1">
            {ancestor.id === '__ellipsis__' ? (
              <span className="text-muted-foreground px-1">…</span>
            ) : (
              <button
                onClick={() => onNavigate?.(ancestor.id)}
                className={cn(
                  "hover:text-foreground transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "rounded px-1 -mx-1"
                )}
              >
                {ancestor.title}
              </button>
            )}
            {(index < visibleAncestors.length - 1 || current) && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />
            )}
          </li>
        ))}
        
        {current && (
          <li className="flex items-center">
            <span className="text-foreground font-medium truncate max-w-[200px] sm:max-w-none">
              {current.title}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
