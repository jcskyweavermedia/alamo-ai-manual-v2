/**
 * useFormViewer Hook
 *
 * Composition hook that combines form templates + search + pin + selection/navigation.
 * Mirrors useDishViewer / useRecipeViewer pattern.
 *
 * - Client-side search (title EN/ES + description)
 * - Splits filtered results into pinned/unpinned lists
 * - Selection + prev/next navigation within filtered list
 */

import { useState, useCallback, useMemo } from 'react';
import { useFormTemplates } from '@/hooks/use-form-templates';
import { usePinnedForms } from '@/hooks/use-pinned-forms';
import type { FormTemplate } from '@/types/forms';

export function useFormViewer() {
  const { templates: allTemplates, isLoading, error } = useFormTemplates();
  const { togglePin, isPinned, sortPinnedFirst } = usePinnedForms();

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Client-side search filter (works well for <= 50 templates)
  // ---------------------------------------------------------------------------

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return allTemplates;

    const q = searchQuery.toLowerCase().trim();
    return allTemplates.filter(
      t =>
        t.titleEn.toLowerCase().includes(q) ||
        t.titleEs?.toLowerCase().includes(q) ||
        t.descriptionEn?.toLowerCase().includes(q) ||
        t.descriptionEs?.toLowerCase().includes(q),
    );
  }, [allTemplates, searchQuery]);

  // ---------------------------------------------------------------------------
  // Pinned / unpinned split
  // ---------------------------------------------------------------------------

  const pinnedTemplates = useMemo(
    () => filteredTemplates.filter(t => isPinned(t.slug)),
    [filteredTemplates, isPinned],
  );

  const unpinnedTemplates = useMemo(
    () => filteredTemplates.filter(t => !isPinned(t.slug)),
    [filteredTemplates, isPinned],
  );

  // ---------------------------------------------------------------------------
  // Selection + prev/next navigation (mirrors useDishViewer)
  // ---------------------------------------------------------------------------

  const selectedTemplate = useMemo<FormTemplate | undefined>(
    () => (selectedSlug ? allTemplates.find(t => t.slug === selectedSlug) : undefined),
    [selectedSlug, allTemplates],
  );

  const currentIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return filteredTemplates.findIndex(t => t.slug === selectedSlug);
  }, [selectedSlug, filteredTemplates]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredTemplates.length - 1;

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedSlug(filteredTemplates[currentIndex - 1].slug);
    }
  }, [currentIndex, filteredTemplates]);

  const goToNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < filteredTemplates.length - 1) {
      setSelectedSlug(filteredTemplates[currentIndex + 1].slug);
    }
  }, [currentIndex, filteredTemplates]);

  const selectTemplate = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlug(null);
  }, []);

  return {
    // Data
    allTemplates,
    filteredTemplates,
    pinnedTemplates,
    unpinnedTemplates,

    // Search
    searchQuery,
    setSearchQuery,

    // Pin
    togglePin,
    isPinned,
    sortPinnedFirst,

    // Selection / navigation
    selectedSlug,
    selectedTemplate,
    selectTemplate,
    clearSelection,
    currentIndex,
    hasPrev,
    hasNext,
    goToPrev,
    goToNext,

    // Loading / error
    isLoading,
    error,
  };
}
