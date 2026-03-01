import { useState, useCallback, useMemo } from 'react';
import { useSupabaseCocktails } from '@/hooks/use-supabase-cocktails';
import type { Cocktail, CocktailStyle, ProductSortMode } from '@/types/products';

export type CocktailFilterMode = 'all' | CocktailStyle;

export function useCocktailViewer() {
  const { cocktails: allCocktails, isLoading, error } = useSupabaseCocktails();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<CocktailFilterMode>('all');
  const [sortMode, setSortMode] = useState<ProductSortMode>('name');

  const filteredCocktails = useMemo(() => {
    let cocktails = allCocktails;

    if (filterMode !== 'all') {
      cocktails = cocktails.filter(c => c.style === filterMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      cocktails = cocktails.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.keyIngredients.toLowerCase().includes(q) ||
        c.glass.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }

    const sorted = [...cocktails];
    switch (sortMode) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'featured':
        sorted.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [allCocktails, filterMode, searchQuery, sortMode]);

  const selectedCocktail = useMemo<Cocktail | undefined>(
    () => selectedSlug ? allCocktails.find(c => c.slug === selectedSlug) : undefined,
    [selectedSlug, allCocktails]
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredCocktails.findIndex(c => c.slug === selectedSlug);
  }, [selectedSlug, filteredCocktails]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredCocktails.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredCocktails[currentIndex - 1].slug);
    }
  }, [currentIndex, filteredCocktails]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredCocktails.length - 1) {
      setSelectedSlug(filteredCocktails[currentIndex + 1].slug);
    }
  }, [currentIndex, filteredCocktails]);

  const selectCocktail = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return {
    filteredCocktails,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
    selectedCocktail,
    selectCocktail,
    clearSelection,
    currentIndex,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isLoading,
    error,
  };
}
