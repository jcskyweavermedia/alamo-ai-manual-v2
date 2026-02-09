import * as React from "react";
import { cn } from "@/lib/utils";

/* =============================================================================
   TAB BAR ITEM COMPONENT
   Per docs/design-specs.md:
   - Bottom tab: icon + label, strong active state (accent)
   - 44px+ touch target
============================================================================= */

interface TabBarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}

const TabBarItem = React.forwardRef<HTMLButtonElement, TabBarItemProps>(
  ({ className, icon, label, active = false, badge, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center gap-xs",
        "min-h-[44px] min-w-[64px] px-sm py-xs",
        "text-small font-medium",
        "transition-colors duration-micro",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <div className="relative">
        <div className={cn(
          "w-6 h-6 flex items-center justify-center",
          active && "text-primary"
        )}>
          {icon}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className="truncate max-w-full">{label}</span>
    </button>
  )
);
TabBarItem.displayName = "TabBarItem";

export { TabBarItem };
