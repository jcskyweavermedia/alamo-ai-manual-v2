import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   LIST COMPONENTS
   Per docs/design-specs.md:
   - ListRow: Entire row tappable, 44px min height, title + meta + optional icon
   - ListSection: Whitespace grouping, minimal separators
   - ListSeparator: Hairline divider (border token)
============================================================================= */

/**
 * ListSection - Groups list items with optional title
 */
interface ListSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

const ListSection = React.forwardRef<HTMLDivElement, ListSectionProps>(
  ({ className, title, children, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-xs", className)} {...props}>
      {title && (
        <h3 className="text-small font-medium text-muted-foreground px-lg py-sm uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className="bg-card rounded-card overflow-hidden dark:border dark:border-border/50">
        {children}
      </div>
    </div>
  )
);
ListSection.displayName = "ListSection";

/**
 * ListRow - Tappable list item with 44px min height
 */
interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  meta?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  active?: boolean;
  disabled?: boolean;
}

const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  ({ className, title, meta, icon, trailing, showChevron = false, active = false, disabled = false, onClick, ...props }, ref) => (
    <div
      ref={ref}
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={onClick && !disabled ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
        }
      } : undefined}
      className={cn(
        "flex items-center gap-md px-lg min-h-[44px] py-sm",
        "transition-colors duration-micro",
        onClick && !disabled && "cursor-pointer hover:bg-accent active:bg-accent/80",
        active && "bg-accent",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={cn("text-body truncate", active && "text-primary font-medium")}>
          {title}
        </p>
        {meta && (
          <p className="text-small text-muted-foreground truncate">{meta}</p>
        )}
      </div>
      {trailing && (
        <div className="flex-shrink-0 text-muted-foreground">{trailing}</div>
      )}
      {showChevron && (
        <ChevronRight className="flex-shrink-0 h-4 w-4 text-muted-foreground" />
      )}
    </div>
  )
);
ListRow.displayName = "ListRow";

/**
 * ListSeparator - Hairline divider
 */
const ListSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("h-px bg-border ml-lg", className)}
      {...props}
    />
  )
);
ListSeparator.displayName = "ListSeparator";

export { ListSection, ListRow, ListSeparator };
