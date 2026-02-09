import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Lightbulb, CheckSquare, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   CALLOUT COMPONENT
   Per docs/design-specs.md:
   - Critical (safety/food handling): semantic warning styling
   - Tip (best practice): info styling
   - Checklist: clean list with checkbox affordance
   - Warning: general warnings
   - Info: informational callouts
============================================================================= */

const calloutVariants = cva(
  [
    "relative rounded-card p-lg",
    "border-l-4",
    "transition-colors duration-micro",
  ].join(" "),
  {
    variants: {
      variant: {
        critical: "bg-destructive/8 border-l-destructive dark:bg-destructive/12",
        warning: "bg-warning/8 border-l-warning dark:bg-warning/12",
        tip: "bg-primary/8 border-l-primary dark:bg-primary/12",
        info: "bg-muted border-l-muted-foreground",
        checklist: "bg-success/8 border-l-success dark:bg-success/12",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const calloutIconMap = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  tip: Lightbulb,
  info: Info,
  checklist: CheckSquare,
};

const calloutIconColorMap = {
  critical: "text-destructive",
  warning: "text-warning",
  tip: "text-primary",
  info: "text-muted-foreground",
  checklist: "text-success",
};

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  title?: string;
  icon?: React.ReactNode;
  hideIcon?: boolean;
}

const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ className, variant = "info", title, icon, hideIcon = false, children, ...props }, ref) => {
    const IconComponent = calloutIconMap[variant || "info"];
    const iconColor = calloutIconColorMap[variant || "info"];

    return (
      <div
        ref={ref}
        className={cn(calloutVariants({ variant, className }))}
        role="note"
        {...props}
      >
        <div className="flex gap-md">
          {!hideIcon && (
            <div className={cn("flex-shrink-0 mt-0.5", iconColor)}>
              {icon || <IconComponent className="w-5 h-5" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className={cn("text-subsection mb-xs", iconColor)}>
                {title}
              </h4>
            )}
            <div className="text-body text-foreground">{children}</div>
          </div>
        </div>
      </div>
    );
  }
);
Callout.displayName = "Callout";

export { Callout, calloutVariants };
