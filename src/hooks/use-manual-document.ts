/**
 * Hook for fetching manual document content from Supabase
 * 
 * Retrieves Markdown content for a specific section and language.
 * Uses the get_manual_section RPC function.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, type Language } from './use-language';

// =============================================================================
// TYPES
// =============================================================================

export interface ManualDocument {
  id: string;
  parentId: string | null;
  slug: string;
  filePath: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  icon: string | null;
  updatedAt: Date;
  hasTranslation: boolean;
}

export interface UseManualDocumentReturn {
  /** The document data */
  document: ManualDocument | null;
  /** Raw markdown content */
  markdown: string;
  /** Document last updated date */
  updatedAt: Date | null;
  /** Whether content is in requested language */
  isRequestedLanguage: boolean;
  /** Whether Spanish translation exists */
  hasSpanishVersion: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Fetch document content for a section
 * 
 * @param sectionId - The section ID or slug to fetch
 * @param language - Preferred language ('en' | 'es') - optional, uses context if not provided
 */
export function useManualDocument(
  sectionId: string | undefined,
  language?: Language
): UseManualDocumentReturn {
  const { language: contextLanguage } = useLanguage();
  const effectiveLanguage = language ?? contextLanguage;

  const { data, isLoading, error } = useQuery({
    queryKey: ['manual-document', sectionId, effectiveLanguage],
    queryFn: async (): Promise<ManualDocument | null> => {
      if (!sectionId) return null;

      const { data, error } = await supabase
        .rpc('get_manual_section', { 
          section_slug: sectionId, 
          language: effectiveLanguage 
        });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const row = data[0];
      return {
        id: row.id,
        parentId: row.parent_id,
        slug: row.slug,
        filePath: row.file_path,
        title: row.title,
        content: row.content || '',
        category: row.category,
        tags: row.tags || [],
        icon: row.icon,
        updatedAt: new Date(row.updated_at),
        hasTranslation: row.has_translation,
      };
    },
    enabled: !!sectionId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Determine if content is in requested language
  // If user requested Spanish and there's a translation, content is in Spanish
  // If user requested Spanish but no translation, content falls back to English
  const isRequestedLanguage = effectiveLanguage === 'en' || (data?.hasTranslation ?? false);

  return {
    document: data ?? null,
    markdown: data?.content ?? '',
    updatedAt: data?.updatedAt ?? null,
    isRequestedLanguage,
    hasSpanishVersion: data?.hasTranslation ?? false,
    isLoading,
    error: error as Error | null,
  };
}
