import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* =============================================================================
   STATUS BADGE COMPONENT
   Per docs/design-specs.md:
   - Indexed (success): Green - content is indexed and ready
   - Pending (warning): Yellow - processing or waiting
   - Error (destructive): Red - failed or needs attention
   - Info: Blue/Indigo - informational
============================================================================= */

const statusBadgeVariants = cva(
  [
    "inline-flex items-center gap-xs px-sm py-xs",
    "rounded-full text-small font-medium",
    "transition-colors duration-micro",
  ].join(" "),
  {
    variants: {
      variant: {
        success: "bg-success/12 text-success dark:bg-success/20",
        pending: "bg-warning/12 text-warning dark:bg-warning/20",
        error: "bg-destructive/12 text-destructive dark:bg-destructive/20",
        info: "bg-primary/12 text-primary dark:bg-primary/20",
        neutral: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "text-small px-sm py-0.5",
        default: "text-small px-sm py-xs",
        lg: "text-caption px-md py-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusBadgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            variant === "success" && "bg-success",
            variant === "pending" && "bg-warning",
            variant === "error" && "bg-destructive",
            variant === "info" && "bg-primary",
            variant === "neutral" && "bg-muted-foreground"
          )}
        />
      )}
      {children}
    </span>
  )
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };
