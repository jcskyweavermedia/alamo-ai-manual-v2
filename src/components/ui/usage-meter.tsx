import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================================
   USAGE METER COMPONENT
   Per docs/design-specs.md:
   - AI usage: gentle meter + "X remaining today"
   - Warn at 80%/95%
============================================================================= */

export interface UsageMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of queries used */
  used: number;
  /** Total limit for the period */
  total: number;
  /** Label text (e.g., "remaining today") */
  label?: string;
  /** Show sparkles icon */
  showIcon?: boolean;
  /** Show loading skeleton */
  isLoading?: boolean;
}

const UsageMeter = React.forwardRef<HTMLDivElement, UsageMeterProps>(
  ({ className, used, total, label = "remaining today", showIcon = true, isLoading = false, ...props }, ref) => {
    const remaining = Math.max(0, total - used);
    const percentage = total > 0 ? (used / total) * 100 : 0;
    
    // Determine warning state
    const isWarning = percentage >= 80 && percentage < 95;
    const isCritical = percentage >= 95;

    // Loading skeleton
    if (isLoading) {
      return (
        <div ref={ref} className={cn("space-y-xs animate-pulse", className)} {...props}>
          <div className="flex items-center justify-between gap-md">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
          <div className="h-1.5 bg-muted rounded-full" />
        </div>
      );
    }

    const barColor = isCritical
      ? "bg-destructive"
      : isWarning
      ? "bg-warning"
      : "bg-orange-500";

    const textColor = isCritical
      ? "text-destructive"
      : isWarning
      ? "text-warning"
      : "text-muted-foreground";

    return (
      <div
        ref={ref}
        className={cn("space-y-xs", className)}
        {...props}
      >
        <div className="flex items-center justify-between gap-md">
          <div className="flex items-center gap-xs">
            {showIcon && (
              <span className="text-sm leading-none">⚡</span>
            )}
            <span className={cn("text-small font-medium", textColor)}>
              {remaining} {label}
            </span>
          </div>
          <span className="text-small text-muted-foreground">
            {used}/{total}
          </span>
        </div>
        
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-transition",
              barColor
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={total}
          />
        </div>

        {isCritical && (
          <p className="text-small text-destructive">
            You're almost out of AI queries. Usage resets at midnight.
          </p>
        )}
        {isWarning && !isCritical && (
          <p className="text-small text-warning">
            Running low on AI queries.
          </p>
        )}
      </div>
    );
  }
);
UsageMeter.displayName = "UsageMeter";

export { UsageMeter };
