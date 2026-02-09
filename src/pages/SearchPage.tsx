import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, MetaText } from "@/components/ui/typography";
import { SearchInput } from "@/components/ui/search-input";
import { SearchResults } from "@/components/ui/search-results";
import { RecentSearches } from "@/components/ui/recent-searches";
import { useLanguage } from "@/hooks/use-language";
import { useManualSearch } from "@/hooks/use-manual-search";
import { useDebounce } from "@/hooks/use-debounce";
import { useRecentSearches } from "@/hooks/use-recent-searches";

/* =============================================================================
   SEARCH PAGE
   Per docs/plans/step-4-search-mvp.md Phase 4:
   - Live search with debounced input
   - Uses SearchResults component for displaying results
   - Navigates to manual section on result click
   - Supports ?q= URL parameter for deep linking
============================================================================= */

const SearchPage = () => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize query from URL parameter or empty string
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);

  const { results, isLoading, error, retry } = useManualSearch(debouncedQuery);
  const {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useRecentSearches();

  // Sync URL with query (for shareability)
  useEffect(() => {
    const currentParam = searchParams.get("q") || "";
    if (debouncedQuery !== currentParam) {
      if (debouncedQuery) {
        setSearchParams({ q: debouncedQuery }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [debouncedQuery, searchParams, setSearchParams]);

  // Handle external URL changes (e.g., browser back/forward)
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    if (urlQuery !== query) {
      setQuery(urlQuery);
    }
  }, [searchParams]);

  // Auto-focus search input on mount (ensures focus when navigating from header)
  useEffect(() => {
    // Small delay to ensure DOM is ready after navigation
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Handle result click - save to recent searches
  const handleResultClick = useCallback(
    (slug: string) => {
      if (debouncedQuery.trim()) {
        addRecentSearch(debouncedQuery);
      }
      navigate(`/manual/${slug}`);
    },
    [debouncedQuery, addRecentSearch, navigate]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback((searchQuery: string) => {
    setQuery(searchQuery);
    inputRef.current?.focus();
  }, []);

  // Handle clear input
  const handleClearInput = useCallback(() => {
    setQuery("");
    inputRef.current?.focus();
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl+K to focus, Escape to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to clear and blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        if (query) {
          setQuery("");
        } else {
          inputRef.current?.blur();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  const labels = {
    title: language === "es" ? "Buscar" : "Search",
    subtitle:
      language === "es"
        ? "Buscar en todos los manuales y procedimientos"
        : "Search across all manuals and procedures",
    placeholder:
      language === "es" ? "Buscar en el manual..." : "Search the manual...",
    shortcut: "⌘K",
  };

  // Show recent searches when input is empty and not loading
  const showRecentSearches = !query && !isLoading && recentSearches.length > 0;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
    >
      <div className="space-y-xl">
        {/* Header */}
        <div className="space-y-sm">
          <PageTitle>{labels.title}</PageTitle>
          <MetaText>{labels.subtitle}</MetaText>
        </div>

        {/* Search Input with keyboard shortcut hint */}
        <div className="relative">
          <SearchInput
            ref={inputRef}
            placeholder={labels.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={handleClearInput}
            autoFocus
          />
          {/* Keyboard shortcut hint (desktop only) */}
          {!query && (
            <kbd className="hidden sm:flex absolute right-12 top-1/2 -translate-y-1/2 h-6 px-2 items-center rounded bg-muted text-xs text-muted-foreground font-mono">
              {labels.shortcut}
            </kbd>
          )}
        </div>

        {/* Recent Searches */}
        {showRecentSearches && (
          <RecentSearches
            searches={recentSearches}
            onSearchClick={handleRecentSearchClick}
            onRemove={removeRecentSearch}
            onClearAll={clearRecentSearches}
            language={language}
          />
        )}

        {/* Results */}
        <SearchResults
          results={results}
          isLoading={isLoading}
          query={debouncedQuery}
          onResultClick={handleResultClick}
          language={language}
          error={error}
          onRetry={retry}
        />
      </div>
    </AppShell>
  );
};

export default SearchPage;
