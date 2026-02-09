/**
 * Hook for accessing manual sections from Supabase
 * 
 * Provides hierarchical navigation data for the manual.
 * Queries Supabase using the get_manual_tree RPC function.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, type Language } from './use-language';

// =============================================================================
// TYPES
// =============================================================================

export interface ManualSection {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  icon: string | null;
  sortOrder: number;
  level: number;
  isCategory: boolean;
  hasContent: boolean;
}

export interface SectionTreeNode extends ManualSection {
  children: SectionTreeNode[];
}

export interface UseManualSectionsReturn {
  /** All sections (flat list) */
  sections: ManualSection[];
  /** Top-level categories only */
  categories: ManualSection[];
  /** Hierarchical tree structure */
  tree: SectionTreeNode[];
  /** Get section by ID */
  getSectionById: (id: string) => ManualSection | undefined;
  /** Get section by slug */
  getSectionBySlug: (slug: string) => ManualSection | undefined;
  /** Get direct children of a section */
  getChildren: (parentId: string) => ManualSection[];
  /** Get ancestor chain (for breadcrumbs) */
  getAncestors: (id: string) => ManualSection[];
  /** Get sibling sections (for "Related") */
  getSiblings: (id: string) => ManualSection[];
  /** Get localized title (returns section.title since it's already localized) */
  getTitle: (section: ManualSection, language: Language) => string;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

// =============================================================================
// HELPER: Build Section Tree
// =============================================================================

export function buildSectionTree(sections: ManualSection[]): SectionTreeNode[] {
  const map = new Map<string, SectionTreeNode>();
  const roots: SectionTreeNode[] = [];

  // First pass: create map with empty children arrays
  sections.forEach(section => {
    map.set(section.id, { ...section, children: [] });
  });

  // Second pass: build tree structure
  sections.forEach(section => {
    const node = map.get(section.id)!;
    if (section.parentId && map.has(section.parentId)) {
      map.get(section.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children by sortOrder recursively
  const sortChildren = (nodes: SectionTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach(node => sortChildren(node.children));
  };
  sortChildren(roots);

  return roots;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function useManualSections(): UseManualSectionsReturn {
  const { language } = useLanguage();

  // Fetch sections from Supabase
  const { data: sections = [], isLoading, error } = useQuery({
    queryKey: ['manual-sections', language],
    queryFn: async (): Promise<ManualSection[]> => {
      const { data, error } = await supabase
        .rpc('get_manual_tree', { language });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        parentId: row.parent_id,
        slug: row.slug,
        title: row.title,
        icon: row.icon,
        sortOrder: row.sort_order,
        level: row.level,
        isCategory: row.is_category,
        hasContent: row.has_content,
      }));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Content + navigation can be updated by admins; keep staff UIs reasonably fresh
    refetchInterval: 60 * 1000, // 1 minute
    refetchIntervalInBackground: false,
  });

  // Memoized computed values
  const categories = useMemo(
    () => sections.filter(s => s.parentId === null && s.isCategory),
    [sections]
  );

  const tree = useMemo(
    () => buildSectionTree(sections),
    [sections]
  );

  // Helper functions - memoized
  const getSectionById = useCallback(
    (id: string): ManualSection | undefined => sections.find(s => s.id === id),
    [sections]
  );

  const getSectionBySlug = useCallback(
    (slug: string): ManualSection | undefined => sections.find(s => s.slug === slug),
    [sections]
  );

  const getChildren = useCallback(
    (parentId: string): ManualSection[] => 
      sections
        .filter(s => s.parentId === parentId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [sections]
  );

  const getAncestors = useCallback(
    (id: string): ManualSection[] => {
      const ancestors: ManualSection[] = [];
      let current = getSectionById(id);
      
      while (current?.parentId) {
        const parent = getSectionById(current.parentId);
        if (parent) {
          ancestors.unshift(parent);
          current = parent;
        } else {
          break;
        }
      }
      
      return ancestors;
    },
    [getSectionById]
  );

  const getSiblings = useCallback(
    (id: string): ManualSection[] => {
      const section = getSectionById(id);
      if (!section) return [];
      
      return sections
        .filter(s => s.parentId === section.parentId && s.id !== id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
    },
    [sections, getSectionById]
  );

  // Title is already localized from the RPC call
  const getTitle = useCallback(
    (section: ManualSection, _language: Language): string => section.title,
    []
  );

  return {
    sections,
    categories,
    tree,
    getSectionById,
    getSectionBySlug,
    getChildren,
    getAncestors,
    getSiblings,
    getTitle,
    isLoading,
    error: error as Error | null,
  };
}
