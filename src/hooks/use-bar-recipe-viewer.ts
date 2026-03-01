import { useState, useCallback, useMemo } from 'react';
import type { PrepRecipe, ProductSortMode } from '@/types/products';

export const BATCH_OPTIONS = [0.5, 1, 2, 4] as const;

export function useBarRecipeViewer(recipes: PrepRecipe[]) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ProductSortMode>('name');
  const [batchMultiplier, setBatchMultiplier] = useState(1);

  const filteredRecipes = useMemo(() => {
    let filtered = recipes;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q)) ||
        r.prepType.toLowerCase().includes(q)
      );
    }

    const sorted = [...filtered];
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
  }, [recipes, searchQuery, sortMode]);

  const selectedRecipe = useMemo<PrepRecipe | undefined>(
    () => selectedSlug ? recipes.find(r => r.slug === selectedSlug) : undefined,
    [selectedSlug, recipes]
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredRecipes.findIndex(r => r.slug === selectedSlug);
  }, [selectedSlug, filteredRecipes]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredRecipes.length - 1;

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredRecipes[currentIndex - 1].slug);
      setBatchMultiplier(1);
    }
  }, [currentIndex, filteredRecipes]);

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredRecipes.length - 1) {
      setSelectedSlug(filteredRecipes[currentIndex + 1].slug);
      setBatchMultiplier(1);
    }
  }, [currentIndex, filteredRecipes]);

  const selectRecipe = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setBatchMultiplier(1);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
    setBatchMultiplier(1);
  }, []);

  return {
    recipes: filteredRecipes,
    selectedRecipe,
    searchQuery,
    setSearchQuery,
    sortMode,
    setSortMode,
    selectRecipe,
    clearSelection,
    batchMultiplier,
    setBatchMultiplier,
    goNext,
    goPrev,
    hasNext,
    hasPrev,
  };
}
