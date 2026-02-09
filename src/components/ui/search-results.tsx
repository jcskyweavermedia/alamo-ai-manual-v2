import * as React from "react";
import { FileText, Search, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlightMatches } from "@/lib/highlight";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { type SearchResult } from "@/hooks/use-manual-search";

/* =============================================================================
   SEARCH RESULTS COMPONENT
   Per docs/plans/step-4-search-mvp.md Phase 4 & 6:
   - Result cards with title (highlighted), snippet (with HTML highlights), category badge
   - Loading state with skeletons
   - Empty states for no query and no results
   - Error state with retry option
============================================================================= */

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
  query: string;
  onResultClick: (slug: string) => void;
  /** Language for localized empty state messages */
  language?: "en" | "es";
  /** Error object if search failed */
  error?: Error | null;
  /** Retry callback for error recovery */
  onRetry?: () => void;
}

export function SearchResults({
  results,
  isLoading,
  query,
  onResultClick,
  language = "en",
  error,
  onRetry,
}: SearchResultsProps) {
  const isSpanish = language === "es";

  // Error state with retry button
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-lg">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-subsection text-foreground mb-xs">
          {isSpanish ? "Error de búsqueda" : "Search error"}
        </h3>
        <p className="text-body text-muted-foreground max-w-reading-sm mb-lg">
          {error.message}
        </p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {isSpanish ? "Intentar de nuevo" : "Try again"}
          </Button>
        )}
      </div>
    );
  }

  // Loading state with skeleton cards
  if (isLoading) {
    return (
      <div className="space-y-md" role="status" aria-label={isSpanish ? "Cargando resultados" : "Loading results"}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-md">
            <div className="flex items-start gap-md">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-sm">
                <div className="flex items-center gap-sm">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Query too short - prompt user
  if (query.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-lg">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-subsection text-foreground mb-xs">
          {isSpanish ? "Comienza a buscar" : "Start searching"}
        </h3>
        <p className="text-body text-muted-foreground max-w-reading-sm">
          {isSpanish
            ? "Escribe al menos 2 caracteres para buscar"
            : "Type at least 2 characters to search"}
        </p>
      </div>
    );
  }

  // No results found
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-2xl text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-lg">
          <Search className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-subsection text-foreground mb-xs">
          {isSpanish ? "Sin resultados" : "No results found"}
        </h3>
        <p className="text-body text-muted-foreground max-w-reading-sm">
          {isSpanish
            ? `No se encontraron resultados para "${query}". Intenta con otras palabras.`
            : `No results for "${query}". Try different keywords.`}
        </p>
      </div>
    );
  }

  // Results list
  return (
    <div className="space-y-md">
      <p className="text-small text-muted-foreground">
        {results.length} {isSpanish ? "resultado" : "result"}
        {results.length !== 1 ? "s" : ""}{" "}
        {isSpanish ? "encontrado" : "found"}
        {results.length !== 1 && !isSpanish ? "" : ""}
      </p>
      {results.map((result) => (
        <SearchResultCard
          key={result.id}
          result={result}
          query={query}
          onClick={() => onResultClick(result.slug)}
        />
      ))}
    </div>
  );
}

/* =============================================================================
   SEARCH RESULT CARD
   Individual result card with icon, highlighted title, snippet, and category badge
============================================================================= */

interface SearchResultCardProps {
  result: SearchResult;
  query: string;
  onClick: () => void;
}

function SearchResultCard({ result, query, onClick }: SearchResultCardProps) {
  // Highlight query terms in the title
  const highlightedTitle = highlightMatches(result.title, query);

  return (
    <Card
      className={cn(
        "p-md cursor-pointer transition-colors",
        "hover:bg-accent/50 dark:hover:border-border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      onClick={onClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-start gap-md">
        <div className="mt-1 p-2 rounded-lg bg-muted flex-shrink-0">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0 space-y-sm">
          <div className="flex items-center gap-sm flex-wrap">
            {/* Title with highlighted query matches */}
            <h3
              className="font-medium text-foreground [&>mark]:bg-accent [&>mark]:text-accent-foreground [&>mark]:px-0.5 [&>mark]:rounded"
              dangerouslySetInnerHTML={{ __html: highlightedTitle }}
            />
            <Badge variant="secondary" className="text-xs">
              {result.category}
            </Badge>
          </div>
          {/* Snippet with highlighted matches from Postgres ts_headline */}
          <p
            className="text-sm text-muted-foreground line-clamp-2 [&>mark]:bg-accent [&>mark]:text-accent-foreground [&>mark]:px-0.5 [&>mark]:rounded"
            dangerouslySetInnerHTML={{ __html: result.snippet }}
          />
          {result.tags.length > 0 && (
            <div className="flex gap-xs flex-wrap">
              {result.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
