/**
 * TranslationBadge
 *
 * Small status indicator pill showing the translation state of a product.
 * Displays one of four states: not translated, partially translated,
 * fully translated, or needs update (stale).
 *
 * Phase 6: Translation System
 */

import { useMemo } from 'react';
import { Globe, Check, AlertTriangle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { extractTranslatableTexts, getFieldValue } from '@/lib/translatable-fields';
import {
  useProductTranslations,
  isTranslationStale,
} from '@/hooks/use-product-translations';

// =============================================================================
// TYPES
// =============================================================================

interface TranslationBadgeProps {
  productTable: string;
  productId: string | null;
  productData: Record<string, unknown>;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslationBadge({
  productTable,
  productId,
  productData,
  className,
}: TranslationBadgeProps) {
  const { translations, loading } = useProductTranslations(
    productTable,
    productId,
  );

  // All hooks must be called before any early returns (React rules of hooks)
  const translatableTexts = useMemo(
    () => extractTranslatableTexts(productTable, productData),
    [productTable, productData],
  );
  const totalFields = translatableTexts.length;

  // Don't render for unsaved products
  if (!productId) return null;

  // Avoid flash while loading
  if (loading) return null;

  // If no translatable fields exist for this product type, don't render
  if (totalFields === 0) return null;

  // Count translated and stale fields
  let translatedCount = 0;
  let hasStale = false;

  for (const field of translatableTexts) {
    const row = translations.get(field.fieldPath);
    if (row) {
      translatedCount++;
      const currentText = getFieldValue(productData, field.fieldPath);
      if (currentText !== null && isTranslationStale(row, currentText)) {
        hasStale = true;
      }
    }
  }

  // Determine display state
  const baseStyles =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium';

  // State: has stale translations (takes priority)
  if (hasStale) {
    return (
      <span
        className={cn(
          baseStyles,
          'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          className,
        )}
      >
        <AlertTriangle className="h-3 w-3" />
        Needs update
      </span>
    );
  }

  // State: fully translated, all fresh
  if (translatedCount === totalFields) {
    return (
      <span
        className={cn(
          baseStyles,
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          className,
        )}
      >
        <Globe className="h-3 w-3" />
        <Check className="h-3 w-3 -ml-0.5" />
        Translated
      </span>
    );
  }

  // State: partially translated
  if (translatedCount > 0) {
    return (
      <span
        className={cn(
          baseStyles,
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          className,
        )}
      >
        <Globe className="h-3 w-3" />
        {translatedCount}/{totalFields} translated
      </span>
    );
  }

  // State: not translated at all
  return (
    <span
      className={cn(
        baseStyles,
        'bg-muted text-muted-foreground',
        className,
      )}
    >
      <Globe className="h-3 w-3" />
      Not translated
    </span>
  );
}
