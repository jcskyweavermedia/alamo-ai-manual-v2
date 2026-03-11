import type { Language } from '@/hooks/use-language';

/**
 * Shared bilingual strings used across 5+ components.
 * NOT an i18n library — just a DRY constants file for commonly repeated labels.
 */
export const COMMON_STRINGS = {
  en: {
    all: 'All',
    search: 'Search...',
    sortAZ: 'A–Z',
    sortNew: 'New',
    featured: 'Featured',
    noResults: 'No results found',
    failedToLoad: 'Failed to load',
    back: 'Back',
    notes: 'Notes',
    topSeller: 'Top Seller',
    loading: 'Loading...',
  },
  es: {
    all: 'Todos',
    search: 'Buscar...',
    sortAZ: 'A–Z',
    sortNew: 'Nuevo',
    featured: 'Destacado',
    noResults: 'Sin resultados',
    failedToLoad: 'Error al cargar',
    back: 'Volver',
    notes: 'Notas',
    topSeller: 'Más Vendido',
    loading: 'Cargando...',
  },
} as const;

/** Shorthand: `const c = getCommon(language)` */
export function getCommon(language: Language) {
  return COMMON_STRINGS[language];
}
