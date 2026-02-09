import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   SIDEBAR ITEM COMPONENT
   Per docs/design-specs.md:
   - Desktop/tablet: grouped sections with quick search
   - 44px touch target
============================================================================= */

interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  hasChildren?: boolean;
  expanded?: boolean;
}

const SidebarItem = React.forwardRef<HTMLButtonElement, SidebarItemProps>(
  ({ className, icon, label, active = false, collapsed = false, hasChildren = false, expanded = false, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "flex items-center gap-md w-full",
        "min-h-[44px] px-md py-sm",
        "text-body font-medium rounded-lg",
        "transition-colors duration-micro",
        active
          ? "bg-accent text-primary"
          : "text-foreground hover:bg-accent/50",
        collapsed && "justify-center px-sm",
        className
      )}
      {...props}
    >
      {icon && (
        <div className={cn(
          "w-5 h-5 flex-shrink-0 flex items-center justify-center",
          active ? "text-primary" : "text-muted-foreground"
        )}>
          {icon}
        </div>
      )}
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {hasChildren && (
            <ChevronDown className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-micro",
              expanded && "rotate-180"
            )} />
          )}
        </>
      )}
    </button>
  )
);
SidebarItem.displayName = "SidebarItem";

/**
 * SidebarSection - Groups sidebar items with optional title
 */
interface SidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  collapsed?: boolean;
}

const SidebarSection = React.forwardRef<HTMLDivElement, SidebarSectionProps>(
  ({ className, title, collapsed = false, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-xs", className)} {...props}>
      {title && !collapsed && (
        <h3 className="text-small font-medium text-muted-foreground px-md py-xs uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className="space-y-xs">{children}</div>
    </div>
  )
);
SidebarSection.displayName = "SidebarSection";

export { SidebarItem, SidebarSection };
