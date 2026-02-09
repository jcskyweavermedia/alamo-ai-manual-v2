import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* =============================================================================
   EMPTY STATE COMPONENT
   Per docs/design-specs.md:
   - Friendly empty view with recovery action
============================================================================= */

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center py-2xl px-lg",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-lg text-muted-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-subsection text-foreground mb-xs">{title}</h3>
      {description && (
        <p className="text-body text-muted-foreground max-w-reading-sm mb-lg">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="secondary">
          {action.label}
        </Button>
      )}
    </div>
  )
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
