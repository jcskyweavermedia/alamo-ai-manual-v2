/**
 * Highlight Helper Utilities
 * 
 * Functions for highlighting search query matches in text.
 * Used by search results to highlight query terms in titles.
 */

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Highlight matching query terms in text
 * 
 * @param text - The text to highlight matches in
 * @param query - The search query
 * @returns HTML string with <mark> tags around matches
 * 
 * @example
 * highlightMatches("Server Standards", "server")
 * // Returns: "<mark>Server</mark> Standards"
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || query.trim().length < 2) {
    return text;
  }

  // Split query into words and filter short ones
  const words = query
    .trim()
    .split(/\s+/)
    .filter(word => word.length >= 2)
    .map(escapeRegex);

  if (words.length === 0) {
    return text;
  }

  // Create regex to match any of the query words (case-insensitive)
  const pattern = new RegExp(`(${words.join('|')})`, 'gi');
  
  return text.replace(pattern, '<mark>$1</mark>');
}

/**
 * Check if text contains any of the query terms
 * 
 * @param text - The text to search in
 * @param query - The search query
 * @returns Whether any query terms are found
 */
export function hasMatch(text: string, query: string): boolean {
  if (!query || query.trim().length < 2) {
    return false;
  }

  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 2);

  const lowerText = text.toLowerCase();
  
  return words.some(word => lowerText.includes(word));
}
