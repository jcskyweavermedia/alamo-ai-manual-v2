import { useState, useCallback, useMemo } from 'react';
import { useSupabaseDishes } from '@/hooks/use-supabase-dishes';
import type { Dish, DishCategory } from '@/types/products';
import type { DishFilterMode } from '@/components/dishes/DishGrid';
import { CATEGORY_ORDER } from '@/data/mock-dishes';

export type { DishFilterMode };

export function useDishViewer(initialSlug?: string | null) {
  const { dishes: allDishes, isLoading, error } = useSupabaseDishes();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<DishFilterMode>('all');

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

    // Sort by category order, then alphabetical within each category
    dishes = [...dishes].sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.plateType);
      const catB = CATEGORY_ORDER.indexOf(b.plateType);
      if (catA !== catB) return catA - catB;
      return a.menuName.localeCompare(b.menuName);
    });

    return dishes;
  }, [allDishes, filterMode, searchQuery]);

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
