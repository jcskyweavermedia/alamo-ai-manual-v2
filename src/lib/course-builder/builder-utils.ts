// =============================================================================
// Course Builder Utilities
// Key/slug generation, element factories, feature variant metadata,
// shared rendering helpers (used by both builder and player renderers).
// Follows the same pattern as lib/form-builder/builder-utils.ts
// =============================================================================

import type {
  ElementType,
  FeatureVariant,
  CourseElement,
  ContentElement,
  FeatureElement,
  MediaElement,
  ProductViewerElement,
  ProductTable,
  CourseSection,
  QuizConfig,
} from '@/types/course-builder';
import {
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react';

// =============================================================================
// SLUG & KEY GENERATION
// =============================================================================

/**
 * Generate a unique element key for a given type.
 * Format: `{type}_{index}` — deduplicates against existing keys.
 */
export function generateElementKey(type: ElementType, existingKeys: string[]): string {
  let index = 1;
  let key = `${type}_${index}`;
  while (existingKeys.includes(key)) {
    index++;
    key = `${type}_${index}`;
    if (index > 500) break; // safety
  }
  return key;
}

/**
 * Generate a URL-safe slug from a course title.
 */
export function generateCourseSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled-course';
}

// =============================================================================
// PRODUCT TABLE METADATA
// =============================================================================

export const PRODUCT_TABLE_META: Record<ProductTable, {
  labelEn: string; labelEs: string; icon: string; color: string;
}> = {
  foh_plate_specs: { labelEn: 'Dish', labelEs: 'Plato', icon: 'UtensilsCrossed', color: 'orange' },
  wines: { labelEn: 'Wine', labelEs: 'Vino', icon: 'Wine', color: 'red' },
  cocktails: { labelEn: 'Cocktail', labelEs: 'Coctel', icon: 'GlassWater', color: 'cyan' },
  prep_recipes: { labelEn: 'Recipe', labelEs: 'Receta', icon: 'ChefHat', color: 'green' },
  beer_liquor_list: { labelEn: 'Beer & Liquor', labelEs: 'Cerveza y Licor', icon: 'Beer', color: 'amber' },
};

// =============================================================================
// DEFAULT FACTORIES
// =============================================================================

/**
 * Create a default element of the given type.
 * For 'feature' type, a variant must be provided (defaults to 'tip').
 */
export function getDefaultElement(
  type: ElementType,
  variant?: FeatureVariant,
  existingKeys: string[] = [],
): CourseElement {
  const key = generateElementKey(type, existingKeys);

  const base = {
    key,
    ai_instructions: '',
    source_refs: [],
    sort_order: 0,
    status: 'outline' as const,
  };

  switch (type) {
    case 'content': {
      const el: ContentElement = {
        ...base,
        type: 'content',
        title_en: '',
        title_es: '',
        body_en: '',
        body_es: '',
      };
      return el;
    }
    case 'feature': {
      const v = variant || 'tip';
      const el: FeatureElement = {
        ...base,
        type: 'feature',
        variant: v,
        title_en: '',
        title_es: '',
        body_en: '',
        body_es: '',
        icon: FEATURE_VARIANTS[v].icon,
      };
      return el;
    }
    case 'media': {
      const el: MediaElement = {
        ...base,
        type: 'media',
        media_type: 'image',
        caption_en: '',
        caption_es: '',
        alt_text_en: '',
        alt_text_es: '',
      };
      return el;
    }
    case 'product_viewer': {
      const el: ProductViewerElement = {
        ...base,
        type: 'product_viewer',
        status: 'reviewed',
        products: [],
      };
      return el;
    }
  }
}

/**
 * Default quiz configuration for new courses.
 */
export function getDefaultQuizConfig(): QuizConfig {
  return {
    quiz_mode: 'multiple_choice',
    question_count: 10,
    question_pool_size: 30,
    passing_score: 70,
    max_attempts: null,
    cooldown_minutes: 0,
    shuffle_questions: true,
    shuffle_options: true,
    show_feedback_immediately: true,
  };
}

/**
 * Create a default section with a title.
 */
export function getDefaultSection(title: string): CourseSection {
  const id = crypto.randomUUID();
  const slug = generateCourseSlug(title);

  return {
    id,
    courseId: '',
    groupId: '',
    slug,
    titleEn: title,
    titleEs: '',
    elements: [],
    sourceRefs: [],
    generationStatus: 'empty',
    sortOrder: 0,
    estimatedMinutes: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// FEATURE VARIANT METADATA
// =============================================================================

export interface FeatureVariantConfig {
  labelEn: string;
  labelEs: string;
  color: string;
  bgClass: string;
  borderClass: string;
  icon: string; // Lucide icon name
}

export const FEATURE_VARIANTS: Record<FeatureVariant, FeatureVariantConfig> = {
  tip: {
    labelEn: 'Tip',
    labelEs: 'Consejo',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-l-4 border-blue-500',
    icon: 'Lightbulb',
  },
  best_practice: {
    labelEn: 'Best Practice',
    labelEs: 'Mejor Práctica',
    color: 'green',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    borderClass: 'border-l-4 border-green-500',
    icon: 'CheckCircle',
  },
  caution: {
    labelEn: 'Caution',
    labelEs: 'Precaución',
    color: 'amber',
    bgClass: 'bg-amber-50 dark:bg-amber-950/30',
    borderClass: 'border-l-4 border-amber-500',
    icon: 'AlertTriangle',
  },
  warning: {
    labelEn: 'Warning',
    labelEs: 'Advertencia',
    color: 'red',
    bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-l-4 border-red-500',
    icon: 'ShieldAlert',
  },
  did_you_know: {
    labelEn: 'Did You Know?',
    labelEs: '¿Sabías Que?',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-l-4 border-purple-500',
    icon: 'Sparkles',
  },
  key_point: {
    labelEn: 'Key Point',
    labelEs: 'Punto Clave',
    color: 'indigo',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderClass: 'border-l-4 border-indigo-500',
    icon: 'Star',
  },
};

// =============================================================================
// SHARED RENDERING HELPERS
// Used by both builder renderers and read-only player renderers.
// =============================================================================

/**
 * Map Lucide icon string names to their React components.
 * Used by FeatureElementRenderer (builder) and PlayerFeatureRenderer (player).
 */
export const FEATURE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Star,
};

/**
 * Strip a leading markdown heading if it duplicates the element title.
 * AI often generates body starting with `## Title` which repeats the card title.
 */
export function stripDuplicateLeadingHeading(body: string, title: string): string {
  if (!body || !title) return body;
  const lines = body.split('\n');
  const first = lines[0].trim();
  // Match any heading level: # Title, ## Title, ### Title
  const headingMatch = first.match(/^#{1,4}\s+(.+)$/);
  if (headingMatch) {
    const headingText = headingMatch[1].trim();
    // Compare normalized (case-insensitive, ignore trailing punctuation)
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalize(headingText) === normalize(title)) {
      // Remove the first line (and any blank line after it)
      const rest = lines.slice(1);
      while (rest.length > 0 && rest[0].trim() === '') rest.shift();
      return rest.join('\n');
    }
  }
  return body;
}

/**
 * Converts a YouTube URL (watch, short, or embed) to an embed URL.
 */
export function getYouTubeEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Already an embed URL
    if (parsed.pathname.startsWith('/embed/')) {
      return url;
    }

    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
    }

    // Short URL: youtu.be/VIDEO_ID
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${parsed.pathname}`;
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Select the correct bilingual field value based on current language.
 * Falls back to the EN value when the ES value is empty.
 */
export function getLocalizedField(
  element: Record<string, unknown>,
  fieldEn: string,
  fieldEs: string,
  language: 'en' | 'es',
): string {
  if (language === 'es') {
    return ((element[fieldEs] as string) || (element[fieldEn] as string)) ?? '';
  }
  return ((element[fieldEn] as string)) ?? '';
}
