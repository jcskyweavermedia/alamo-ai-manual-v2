import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================================
   LOADING SPINNER COMPONENT
   Per docs/design-specs.md:
   - Subtle, 120-160ms animations (uses duration-micro)
============================================================================= */

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg";
}

const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "w-4 h-4 border-2",
      default: "w-6 h-6 border-2",
      lg: "w-8 h-8 border-3",
    };

    return (
      <div
        ref={ref}
        role="status"
        aria-label="Loading"
        className={cn(
          "animate-spin rounded-full border-primary/30 border-t-primary",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
LoadingSpinner.displayName = "LoadingSpinner";

export { LoadingSpinner };
