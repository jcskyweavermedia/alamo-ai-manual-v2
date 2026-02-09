import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* =============================================================================
   ERROR STATE COMPONENT
   Per docs/design-specs.md:
   - Clear error + recovery action
============================================================================= */

interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title = "Something went wrong",
      description = "We couldn't load this content. Please try again.",
      onRetry,
      retryLabel = "Try again",
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-2xl px-lg",
        className
      )}
      {...props}
    >
      <div className="w-12 h-12 rounded-full bg-destructive/12 flex items-center justify-center mb-lg">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-subsection text-foreground mb-xs">{title}</h3>
      <p className="text-body text-muted-foreground max-w-reading-sm mb-lg">
        {description}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary">
          <RefreshCw className="w-4 h-4 mr-sm" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
);
ErrorState.displayName = "ErrorState";

export { ErrorState };
