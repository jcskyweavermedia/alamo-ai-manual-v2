import { useState, useCallback, useMemo } from 'react';
import { useSupabaseDishes } from '@/hooks/use-supabase-dishes';
import type { Dish, DishCategory, ProductSortMode } from '@/types/products';
import type { DishFilterMode } from '@/components/dishes/DishGrid';

export type { DishFilterMode };

export function useDishViewer(initialSlug?: string | null) {
  const { dishes: allDishes, isLoading, error } = useSupabaseDishes();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<DishFilterMode>('all');
  const [sortMode, setSortMode] = useState<ProductSortMode>('name');

  const filteredDishes = useMemo(() => {
    let dishes = allDishes;

    if (filterMode !== 'all') {
      dishes = dishes.filter(d => d.plateType === filterMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      dishes = dishes.filter(d =>
        d.menuName.toLowerCase().includes(q) ||
        d.shortDescription.toLowerCase().includes(q) ||
        d.keyIngredients.some(i => i.toLowerCase().includes(q))
      );
    }

    const sorted = [...dishes];
    switch (sortMode) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'featured':
        sorted.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
      case 'name':
      default:
        sorted.sort((a, b) => a.menuName.localeCompare(b.menuName));
        break;
    }
    return sorted;
  }, [allDishes, filterMode, searchQuery, sortMode]);

  const selectedDish = useMemo<Dish | undefined>(
    () => selectedSlug ? allDishes.find(d => d.slug === selectedSlug) : undefined,
    [selectedSlug, allDishes]
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredDishes.findIndex(d => d.slug === selectedSlug);
  }, [selectedSlug, filteredDishes]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredDishes.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredDishes[currentIndex - 1].slug);
    }
  }, [currentIndex, filteredDishes]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredDishes.length - 1) {
      setSelectedSlug(filteredDishes[currentIndex + 1].slug);
    }
  }, [currentIndex, filteredDishes]);

  const selectDish = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return {
    filteredDishes,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
    selectedDish,
    selectDish,
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
