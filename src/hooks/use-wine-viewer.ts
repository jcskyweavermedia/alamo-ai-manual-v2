import { useState, useCallback, useMemo } from 'react';
import { useSupabaseWines } from '@/hooks/use-supabase-wines';
import type { Wine, WineStyle, ProductSortMode } from '@/types/products';

export type WineFilterMode = 'all' | WineStyle;

export function useWineViewer() {
  const { wines: allWines, isLoading, error } = useSupabaseWines();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<WineFilterMode>('all');
  const [sortMode, setSortMode] = useState<ProductSortMode>('name');

  const filteredWines = useMemo(() => {
    let wines = allWines;

    if (filterMode !== 'all') {
      wines = wines.filter(w => w.style === filterMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      wines = wines.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.producer.toLowerCase().includes(q) ||
        w.varietal.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) ||
        w.country.toLowerCase().includes(q)
      );
    }

    const sorted = [...wines];
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
  }, [allWines, filterMode, searchQuery, sortMode]);

  const selectedWine = useMemo<Wine | undefined>(
    () => selectedSlug ? allWines.find(w => w.slug === selectedSlug) : undefined,
    [selectedSlug, allWines]
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredWines.findIndex(w => w.slug === selectedSlug);
  }, [selectedSlug, filteredWines]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredWines.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredWines[currentIndex - 1].slug);
    }
  }, [currentIndex, filteredWines]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredWines.length - 1) {
      setSelectedSlug(filteredWines[currentIndex + 1].slug);
    }
  }, [currentIndex, filteredWines]);

  const selectWine = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return {
    filteredWines,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortMode,
    setSortMode,
    selectedWine,
    selectWine,
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
