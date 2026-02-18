import { useState, useCallback, useMemo } from 'react';
import { useSupabaseSOS, type SOSSection } from '@/hooks/use-supabase-sos';
import { SOS_CHAPTER_MAP, SOS_CHAPTERS, type SOSChapter } from '@/constants/sos-chapters';

export type SOSPosition = 'server' | 'bartender' | 'busser' | 'barback';

export interface SOSSectionGroup {
  parent: SOSSection;
  children: SOSSection[];
}

export interface SOSChapterGroup {
  chapter: SOSChapter;
  sectionGroups: SOSSectionGroup[];
}

const ALL_POSITIONS: SOSPosition[] = ['server', 'bartender', 'busser', 'barback'];

export function useSOSScrollViewer() {
  const { sections: allSections, isLoading, error } = useSupabaseSOS();

  const [selectedPosition, setSelectedPosition] = useState<SOSPosition | null>(null);

  // Which positions actually have content
  const availablePositions = useMemo(() => {
    const positionsWithData = new Set(allSections.map(s => s.position));
    return ALL_POSITIONS.filter(p => positionsWithData.has(p));
  }, [allSections]);

  // Section counts per position
  const sectionCounts = useMemo(() => {
    const counts: Record<SOSPosition, number> = { server: 0, bartender: 0, busser: 0, barback: 0 };
    for (const s of allSections) {
      if (s.position in counts) {
        counts[s.position as SOSPosition]++;
      }
    }
    return counts;
  }, [allSections]);

  // All sections for the selected position (sorted by sort_order from query)
  const sections = useMemo(() => {
    if (!selectedPosition) return [];
    return allSections.filter(s => s.position === selectedPosition);
  }, [allSections, selectedPosition]);

  // Groups: top-level sections with their children
  const sectionGroups = useMemo((): SOSSectionGroup[] => {
    const topLevel = sections.filter(s => s.parentKey === null);
    return topLevel.map(parent => ({
      parent,
      children: sections.filter(s => s.parentKey === parent.sectionKey),
    }));
  }, [sections]);

  // Chapter groups: group sectionGroups by their DB chapter column
  const chapterGroups = useMemo((): SOSChapterGroup[] => {
    return SOS_CHAPTERS
      .map(chapter => ({
        chapter,
        sectionGroups: sectionGroups.filter(g => g.parent.chapter === chapter.id),
      }))
      .filter(cg => cg.sectionGroups.length > 0);
  }, [sectionGroups]);

  // Flat ordered keys for observer tracking (includes chapter divider markers)
  const orderedSectionKeys = useMemo((): string[] => {
    return chapterGroups.flatMap(cg => [
      `chapter-${cg.chapter.id}`,
      ...cg.sectionGroups.flatMap(g => [
        g.parent.sectionKey,
        ...g.children.map(c => c.sectionKey),
      ]),
    ]);
  }, [chapterGroups]);

  const selectPosition = useCallback((position: SOSPosition) => {
    setSelectedPosition(position);
  }, []);

  const clearPosition = useCallback(() => {
    setSelectedPosition(null);
  }, []);

  return {
    sections,
    sectionGroups,
    chapterGroups,
    orderedSectionKeys,
    totalSections: sections.length,
    selectedPosition,
    selectPosition,
    clearPosition,
    availablePositions,
    sectionCounts,
    isLoading,
    error,
  };
}
