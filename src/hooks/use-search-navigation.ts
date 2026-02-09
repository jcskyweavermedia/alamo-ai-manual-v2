import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRecentSearches } from "@/hooks/use-recent-searches";

/**
 * Hook to handle header search navigation.
 * Returns a handler that navigates to /search?q={query} when called.
 * Also saves the query to recent searches history.
 */
export function useSearchNavigation() {
  const navigate = useNavigate();
  const { addRecentSearch } = useRecentSearches();

  const handleSearch = useCallback(
    (query: string) => {
      const trimmedQuery = query.trim();
      if (trimmedQuery) {
        // Save to recent searches before navigating
        addRecentSearch(trimmedQuery);
        navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      } else {
        navigate("/search");
      }
    },
    [navigate, addRecentSearch]
  );

  return handleSearch;
}
