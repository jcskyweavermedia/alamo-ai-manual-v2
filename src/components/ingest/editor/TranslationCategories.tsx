/**
 * TranslationCategories
 *
 * Inline category checkboxes + "Translate Selected" button for PrepRecipeEditor.
 * Replaces TranslationSheet for prep recipes. Reads/writes preferences via
 * useTranslationPreferences and translates only selected categories.
 */

import { useMemo, useCallback } from 'react';
import { Globe, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { TranslationBadge } from '../TranslationBadge';
import { extractTranslatableTexts } from '@/lib/translatable-fields';
import { useTranslationPreferences, type CategoryPrefs } from '@/hooks/use-translation-preferences';
import { useTranslateProduct } from '@/hooks/use-translate-product';

// =============================================================================
// TYPES
// =============================================================================

interface TranslationCategoriesProps {
  productId: string | null;
  productData: Record<string, unknown>;
}

// =============================================================================
// CATEGORY UI LABELS
// =============================================================================

const CATEGORIES: { key: keyof CategoryPrefs; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'procedure', label: 'Procedure' },
  { key: 'trainingNotes', label: 'Training Notes' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function TranslationCategories({
  productId,
  productData,
}: TranslationCategoriesProps) {
  const { prefs, setCategory, getActiveCategories } = useTranslationPreferences();
  const { translateFields, saveTranslations, translating, saving } = useTranslateProduct();

  const activeCategories = useMemo(
    () => getActiveCategories('prep_recipes'),
    [getActiveCategories],
  );

  const hasChecked = activeCategories.size > 0;
  const isBusy = translating || saving;

  const handleTranslate = useCallback(async () => {
    if (!productId || !hasChecked) return;

    const texts = extractTranslatableTexts('prep_recipes', productData, activeCategories);
    if (texts.length === 0) return;

    const results = await translateFields(
      'prep_recipes',
      productId,
      texts.map((t) => ({ fieldPath: t.fieldPath, sourceText: t.sourceText })),
    );

    if (results.length > 0) {
      const merged = results.map((r) => {
        const source = texts.find((t) => t.fieldPath === r.fieldPath);
        return {
          fieldPath: r.fieldPath,
          sourceText: source?.sourceText ?? '',
          translatedText: r.translatedText,
        };
      });
      await saveTranslations('prep_recipes', productId, merged);
    }
  }, [productId, hasChecked, productData, activeCategories, translateFields, saveTranslations]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select categories to translate to Spanish.
      </p>

      {/* Category checkboxes */}
      <div className="space-y-2">
        {CATEGORIES.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <Checkbox
              id={`translate-cat-${key}`}
              checked={prefs.prep_recipes[key]}
              onCheckedChange={(checked) =>
                setCategory('prep_recipes', key, checked === true)
              }
              disabled={isBusy}
            />
            <Label
              htmlFor={`translate-cat-${key}`}
              className="text-sm font-normal cursor-pointer"
            >
              {label}
            </Label>
          </div>
        ))}
      </div>

      {/* Rationale */}
      <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
        Procedure is translated by default so prep cooks understand steps in
        their language, while using English ingredient names when communicating
        with chefs.
      </p>

      {/* Translate button */}
      <Button
        variant="outline"
        onClick={handleTranslate}
        disabled={isBusy || !hasChecked || !productId}
        className="w-full"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Globe className="h-4 w-4 mr-2" />
        )}
        {translating ? 'Translating...' : saving ? 'Saving...' : 'Translate Selected'}
      </Button>

      {/* Status badge */}
      <TranslationBadge
        productTable="prep_recipes"
        productId={productId}
        productData={productData}
      />
    </div>
  );
}
