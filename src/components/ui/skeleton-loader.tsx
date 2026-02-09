import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/* =============================================================================
   SKELETON LOADER COMPONENT
   Per docs/design-specs.md:
   - For manual lists, reading pages, AI answer cards
   - Pre-built patterns for common loading states
============================================================================= */

interface SkeletonLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "card" | "list-row" | "avatar" | "paragraph";
  lines?: number;
}

const SkeletonLoader = React.forwardRef<HTMLDivElement, SkeletonLoaderProps>(
  ({ className, variant = "text", lines = 3, ...props }, ref) => {
    if (variant === "text") {
      return (
        <div ref={ref} className={cn("space-y-sm", className)} {...props}>
          <Skeleton className="h-4 w-3/4" />
        </div>
      );
    }

    if (variant === "paragraph") {
      return (
        <div ref={ref} className={cn("space-y-sm", className)} {...props}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
            />
          ))}
        </div>
      );
    }

    if (variant === "avatar") {
      return (
        <div ref={ref} className={className} {...props}>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      );
    }

    if (variant === "list-row") {
      return (
        <div
          ref={ref}
          className={cn("flex items-center gap-md px-lg py-sm min-h-[44px]", className)}
          {...props}
        >
          <Skeleton className="h-6 w-6 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-xs">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      );
    }

    if (variant === "card") {
      return (
        <div
          ref={ref}
          className={cn("p-lg rounded-card bg-card space-y-md", className)}
          {...props}
        >
          <Skeleton className="h-5 w-2/3" />
          <div className="space-y-sm">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      );
    }

    return null;
  }
);
SkeletonLoader.displayName = "SkeletonLoader";

export { SkeletonLoader };
