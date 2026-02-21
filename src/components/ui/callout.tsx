import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
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
        tip: "bg-amber-500/8 border-l-amber-500 dark:bg-amber-500/12",
        info: "bg-muted border-l-muted-foreground",
        checklist: "bg-success/8 border-l-success dark:bg-success/12",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  }
);

const calloutEmojiMap = {
  critical: "\u26A0\uFE0F",
  warning: "\u26A0\uFE0F",
  tip: "\uD83D\uDCA1",
  info: "\u2139\uFE0F",
  checklist: "\u2705",
};

const calloutTitleColorMap = {
  critical: "text-destructive",
  warning: "text-warning",
  tip: "text-amber-600",
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
    const emoji = calloutEmojiMap[variant || "info"];
    const titleColor = calloutTitleColorMap[variant || "info"];

    return (
      <div
        ref={ref}
        className={cn(calloutVariants({ variant, className }))}
        role="note"
        {...props}
      >
        <div className="flex gap-md">
          {!hideIcon && (
            <div className="flex-shrink-0 mt-0.5">
              {icon || <span className="text-[18px] h-[18px] leading-[18px] inline-block">{emoji}</span>}
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && (
              <h4 className={cn("text-subsection mb-xs", titleColor)}>
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
