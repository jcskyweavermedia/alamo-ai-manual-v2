import * as React from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MetaText } from "@/components/ui/typography";

/* =============================================================================
   RECENT SEARCHES COMPONENT
   Per Phase 6 of step-4-search-mvp.md:
   - Display recent search queries
   - Click to re-run search
   - Remove individual items
   - Clear all option
============================================================================= */

interface RecentSearchesProps {
  /** Recent search queries */
  searches: string[];
  /** Callback when a search is clicked */
  onSearchClick: (query: string) => void;
  /** Callback to remove a search */
  onRemove: (query: string) => void;
  /** Callback to clear all searches */
  onClearAll: () => void;
  /** Current language for labels */
  language: "en" | "es";
  /** Additional class names */
  className?: string;
}

const RecentSearches = React.forwardRef<HTMLDivElement, RecentSearchesProps>(
  ({ searches, onSearchClick, onRemove, onClearAll, language, className }, ref) => {
    if (searches.length === 0) return null;

    const labels = {
      title: language === "es" ? "Búsquedas recientes" : "Recent searches",
      clearAll: language === "es" ? "Borrar todo" : "Clear all",
      remove: language === "es" ? "Eliminar" : "Remove",
    };

    return (
      <div ref={ref} className={cn("space-y-sm", className)}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <MetaText className="flex items-center gap-xs">
            <Clock className="h-3.5 w-3.5" />
            {labels.title}
          </MetaText>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {labels.clearAll}
          </Button>
        </div>

        {/* Search chips */}
        <div className="flex flex-wrap gap-sm">
          {searches.map((search) => (
            <div
              key={search}
              className={cn(
                "group flex items-center gap-1 rounded-full",
                "bg-muted/50 hover:bg-muted",
                "pl-3 pr-1 py-1",
                "text-small text-muted-foreground hover:text-foreground",
                "transition-colors duration-micro cursor-pointer"
              )}
            >
              <button
                type="button"
                onClick={() => onSearchClick(search)}
                className="focus:outline-none focus-visible:underline"
              >
                {search}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(search);
                }}
                className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center",
                  "opacity-0 group-hover:opacity-100",
                  "hover:bg-destructive/10 hover:text-destructive",
                  "focus:outline-none focus-visible:opacity-100",
                  "transition-opacity duration-micro"
                )}
                aria-label={`${labels.remove} "${search}"`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
RecentSearches.displayName = "RecentSearches";

export { RecentSearches };
