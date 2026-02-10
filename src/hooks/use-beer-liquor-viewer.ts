import { useState, useCallback, useMemo } from 'react';
import { useSupabaseBeerLiquor } from '@/hooks/use-supabase-beer-liquor';
import type { BeerLiquorItem, BeerLiquorCategory } from '@/types/products';
import {
  groupBySubcategory,
  type BeerLiquorSubcategory,
} from '@/data/mock-beer-liquor';

export type BeerLiquorFilterMode = 'all' | BeerLiquorCategory;

export function useBeerLiquorViewer() {
  const { items: allItems, isLoading, error } = useSupabaseBeerLiquor();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<BeerLiquorFilterMode>('all');

  const filteredItems = useMemo(() => {
    let items = allItems;

    if (filterMode !== 'all') {
      items = items.filter(item => item.category === filterMode);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.producer.toLowerCase().includes(q) ||
        item.subcategory.toLowerCase().includes(q) ||
        item.style.toLowerCase().includes(q) ||
        item.country.toLowerCase().includes(q)
      );
    }

    return items;
  }, [allItems, filterMode, searchQuery]);

  const groupedItems = useMemo<Record<BeerLiquorSubcategory, BeerLiquorItem[]>>(
    () => groupBySubcategory(filteredItems as any),
    [filteredItems]
  );

  // Selection + navigation (new for Phase 6 — B&L card view)
  const selectedItem = useMemo<BeerLiquorItem | undefined>(
    () => selectedSlug ? filteredItems.find(i => i.slug === selectedSlug) : undefined,
    [selectedSlug, filteredItems]
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredItems.findIndex(i => i.slug === selectedSlug);
  }, [selectedSlug, filteredItems]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredItems.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredItems[currentIndex - 1].slug);
    }
  }, [currentIndex, filteredItems]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredItems.length - 1) {
      setSelectedSlug(filteredItems[currentIndex + 1].slug);
    }
  }, [currentIndex, filteredItems]);

  const selectItem = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return {
    filteredItems,
    groupedItems,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    selectedItem,
    selectItem,
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
