import { useState, useCallback, useMemo } from 'react';
import { useSupabaseRecipes } from '@/hooks/use-supabase-recipes';
import type { Recipe } from '@/types/products';

export type FilterMode = 'all' | 'prep' | 'plate';

export const BATCH_OPTIONS = [0.5, 1, 2, 4] as const;

/** Get the category/type label for a recipe (prep_type or plate_type) */
function getRecipeCategory(r: Recipe): string {
  return r.type === 'prep' ? r.prepType : r.plateType;
}

export function useRecipeViewer() {
  const { recipes: allRecipes, isLoading, error } = useSupabaseRecipes();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [navStack, setNavStack] = useState<string[]>([]);

  const filteredRecipes = useMemo(() => {
    let recipes = allRecipes;

    if (filterMode === 'prep') {
      recipes = recipes.filter(r => r.type === 'prep');
    } else if (filterMode === 'plate') {
      recipes = recipes.filter(r => r.type === 'plate');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      recipes = recipes.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q)) ||
        getRecipeCategory(r).toLowerCase().includes(q)
      );
    }

    return recipes;
  }, [allRecipes, filterMode, searchQuery]);

  const getRecipeBySlug = useCallback(
    (slug: string) => allRecipes.find(r => r.slug === slug),
    [allRecipes]
  );

  const selectedRecipe = useMemo<Recipe | undefined>(
    () => selectedSlug ? getRecipeBySlug(selectedSlug) : undefined,
    [selectedSlug, getRecipeBySlug]
  );

  // Prev/Next navigation within filtered list (disabled when cross-linked)
  const currentIndex = useMemo(() => {
    if (!selectedSlug || navStack.length > 0) return -1;
    return filteredRecipes.findIndex(r => r.slug === selectedSlug);
  }, [selectedSlug, filteredRecipes, navStack.length]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredRecipes.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredRecipes[currentIndex - 1].slug);
      setBatchMultiplier(1);
    }
  }, [currentIndex, filteredRecipes]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredRecipes.length - 1) {
      setSelectedSlug(filteredRecipes[currentIndex + 1].slug);
      setBatchMultiplier(1);
    }
  }, [currentIndex, filteredRecipes]);

  const isCrossLinked = navStack.length > 0;
  const parentPlateRecipe = navStack.length > 0
    ? getRecipeBySlug(navStack[navStack.length - 1])
    : undefined;

  const selectRecipe = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setNavStack([]);
    setBatchMultiplier(1);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
    setNavStack([]);
    setBatchMultiplier(1);
  }, []);

  const navigateToPrepRecipe = useCallback((prepSlug: string) => {
    if (selectedSlug) {
      setNavStack(prev => [...prev, selectedSlug]);
    }
    setSelectedSlug(prepSlug);
    setBatchMultiplier(1);
  }, [selectedSlug]);

  const navigateBack = useCallback(() => {
    if (navStack.length > 0) {
      const newStack = [...navStack];
      const parentSlug = newStack.pop()!;
      setNavStack(newStack);
      setSelectedSlug(parentSlug);
      setBatchMultiplier(1);
    } else {
      clearSelection();
    }
  }, [navStack, clearSelection]);

  return {
    filteredRecipes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedSlug,
    selectedRecipe,
    selectRecipe,
    clearSelection,
    batchMultiplier,
    setBatchMultiplier,
    currentIndex,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,
    isCrossLinked,
    parentPlateRecipe,
    navigateToPrepRecipe,
    navigateBack,
    isLoading,
    error,
  };
}
