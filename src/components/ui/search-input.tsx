import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* =============================================================================
   SEARCH INPUT COMPONENT
   Per docs/design-specs.md:
   - Rounded 14-16px, prominent
   - Clear button
   - 44px touch target
============================================================================= */

export interface SearchInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    const hasValue = value !== undefined && value !== "";

    return (
      <div className="relative w-full">
        <Search className="absolute left-md top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          ref={ref}
          value={value}
          className={cn(
            "flex h-11 w-full rounded-lg border border-input bg-background",
            "pl-10 pr-10 py-sm text-body",
            "ring-offset-background transition-colors duration-micro",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Hide native clear button
            "[&::-webkit-search-cancel-button]:hidden",
            className,
          )}
          {...props}
        />
        {hasValue && onClear && (
          <button
            type="button"
            onClick={onClear}
            className={cn(
              "absolute right-1 top-1/2 -translate-y-1/2",
              // 44px touch target with smaller visual appearance
              "h-9 w-9 rounded-full",
              "flex items-center justify-center",
              "hover:bg-muted transition-colors duration-micro"
            )}
            aria-label="Clear search"
          >
            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
              <X className="h-3 w-3 text-muted-foreground" />
            </span>
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
