import { useState } from 'react';
import { Pencil, Eye, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DishAllergenBadge } from '@/components/dishes/DishAllergenBadge';
import { DishCategoryBadge } from '@/components/dishes/DishCategoryBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { useProductTranslations } from '@/hooks/use-product-translations';
import { useTranslateProduct } from '@/hooks/use-translate-product';
import { EditableTranslationText } from './EditableTranslationText';
import { getFieldValue } from '@/lib/translatable-fields';
import type { FohPlateSpecDraft } from '@/types/ingestion';
import type { DishCategory, AllergenType } from '@/types/products';

// =============================================================================
// Info card config (matches DishCardView pattern)
// =============================================================================

const INFO_CARDS: {
  key: string;
  label: string;
  emoji: string;
  bg: string;
  field: keyof FohPlateSpecDraft;
  isChips: boolean;
}[] = [
  { key: 'ingredients', label: 'Key Ingredients', emoji: '\uD83E\uDD69', bg: 'bg-red-100 dark:bg-red-900/30', field: 'keyIngredients', isChips: true },
  { key: 'flavor', label: 'Flavor Profile', emoji: '\uD83C\uDFA8', bg: 'bg-violet-100 dark:bg-violet-900/30', field: 'flavorProfile', isChips: true },
  { key: 'allergy', label: 'Allergy Notes', emoji: '\u26A0\uFE0F', bg: 'bg-amber-100 dark:bg-amber-900/30', field: 'allergyNotes', isChips: false },
  { key: 'upsell', label: 'Upsell Notes', emoji: '\uD83D\uDCB0', bg: 'bg-green-100 dark:bg-green-900/30', field: 'upsellNotes', isChips: false },
];

// =============================================================================
// DishGuideIngestPreview
// =============================================================================

interface DishGuideIngestPreviewProps {
  draft: FohPlateSpecDraft;
  onSwitchToEdit: () => void;
  productId?: string | null;
}

export function DishGuideIngestPreview({ draft, onSwitchToEdit, productId }: DishGuideIngestPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>('en');

  const { translations, refetch } = useProductTranslations(
    productId ? 'foh_plate_specs' : null,
    productId ?? null,
  );
  const { saveTranslations } = useTranslateProduct();

  if (!draft.menuName && !draft.shortDescription) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Eye className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No FOH Plate Spec to preview</p>
        <p className="text-xs mt-1">Generate an FOH Plate Spec from the BOH Plate Spec first</p>
      </div>
    );
  }

  const isEsMode = previewLang === 'es' && productId;

  // Build product data for field lookups
  const productData: Record<string, unknown> = {
    menu_name: draft.menuName,
    short_description: draft.shortDescription,
    detailed_description: draft.detailedDescription,
    allergy_notes: draft.allergyNotes,
    upsell_notes: draft.upsellNotes,
    notes: draft.notes,
  };

  const getTranslated = (fieldPath: string): string | null => {
    const row = translations.get(fieldPath);
    return row ? row.translatedText : null;
  };

  const handleInlineSave = async (fieldPath: string, newText: string) => {
    if (!productId) return;
    const sourceText = getFieldValue(productData, fieldPath) ?? '';
    await saveTranslations('foh_plate_specs', productId, [
      { fieldPath, sourceText, translatedText: newText },
    ]);
    refetch();
  };

  return (
    <div className="space-y-md">
      {/* Two-column header: Info left, Image right */}
      <div className="flex flex-col sm:flex-row gap-md">
        {/* Info column */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Name + category badge + edit button */}
          <div className="flex items-start gap-3">
            <h1 className="text-page-title text-foreground flex-1 min-w-0">
              {isEsMode ? (
                <EditableTranslationText
                  fieldPath="menu_name"
                  englishText={draft.menuName || 'Untitled Dish'}
                  translatedText={getTranslated('menu_name')}
                  onSave={handleInlineSave}
                />
              ) : (
                draft.menuName || 'Untitled Dish'
              )}
            </h1>
            {draft.plateType && (
              <DishCategoryBadge category={draft.plateType as DishCategory} className="shrink-0 mt-1" />
            )}
            <Button variant="outline" size="sm" onClick={onSwitchToEdit} className="shrink-0">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>

          {/* Top seller badge */}
          {draft.isTopSeller && (
            <div>
              <TopSellerBadge size="md" />
            </div>
          )}

          {/* Allergen pills */}
          {draft.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draft.allergens.map(allergen => (
                <DishAllergenBadge key={allergen} allergen={allergen as AllergenType} />
              ))}
            </div>
          )}

          {/* Short description */}
          {draft.shortDescription && (
            <p className="text-sm leading-relaxed text-foreground">
              {isEsMode ? (
                <EditableTranslationText
                  fieldPath="short_description"
                  englishText={draft.shortDescription}
                  translatedText={getTranslated('short_description')}
                  onSave={handleInlineSave}
                />
              ) : (
                draft.shortDescription
              )}
            </p>
          )}

          {/* EN/ES toggle */}
          {productId && (
            <div className="inline-flex rounded-full border border-border overflow-hidden self-start">
              <button
                type="button"
                onClick={() => setPreviewLang('en')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold transition-colors',
                  previewLang === 'en'
                    ? 'bg-orange-500 text-white'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setPreviewLang('es')}
                className={cn(
                  'px-3 py-1 text-xs font-semibold transition-colors',
                  previewLang === 'es'
                    ? 'bg-orange-500 text-white'
                    : 'bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                ES
              </button>
            </div>
          )}
        </div>

        {/* Image */}
        {draft.image ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group sm:w-[40%] shrink-0 rounded-[20px] overflow-hidden cursor-pointer bg-muted shadow-[3px_8px_14px_-3px_rgba(0,0,0,0.4),2px_5px_8px_-2px_rgba(0,0,0,0.25)]"
          >
            <div className="aspect-[16/10]">
              <img
                src={draft.image}
                alt={draft.menuName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <span className={cn(
              'absolute bottom-2 right-2',
              'flex items-center justify-center',
              'h-7 w-7 rounded-md',
              'bg-black/50 text-white',
              'opacity-70 group-hover:opacity-100 transition-opacity'
            )}>
              <Expand className="h-3.5 w-3.5" />
            </span>
          </button>
        ) : (
          <div className="sm:w-[40%] shrink-0 aspect-[16/10] rounded-[20px] bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">No image</span>
          </div>
        )}
      </div>

      {/* 2x2 Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INFO_CARDS.map(card => {
          const value = draft[card.field];
          const text = card.isChips
            ? (value as string[]).join(' \u00B7 ')
            : (value as string);

          return (
            <div key={card.key} className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
              {/* Emoji tile -- top right */}
              <span className={cn(
                'absolute top-3 right-3',
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                card.bg
              )}>
                <span className="text-[22px] h-[22px] leading-[22px]">{card.emoji}</span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                {card.label}
              </h2>
              {card.key === 'ingredients' ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {(draft.keyIngredients as string[]).join(' \u00B7 ')}
                  </p>
                  {draft.ingredients.length > 0 && (
                    <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">
                      {draft.ingredients.join(' \u00B7 ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {text || <span className="text-muted-foreground italic">Not set</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Description */}
      {draft.detailedDescription && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Detailed Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {isEsMode ? (
              <EditableTranslationText
                fieldPath="detailed_description"
                englishText={draft.detailedDescription}
                translatedText={getTranslated('detailed_description')}
                onSave={handleInlineSave}
              />
            ) : (
              draft.detailedDescription
            )}
          </p>
        </section>
      )}

      {/* Notes */}
      {draft.notes && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Notes
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {draft.notes}
          </p>
        </section>
      )}

      {/* Lightbox */}
      {lightboxOpen && draft.image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className={cn(
              'absolute top-4 right-4',
              'flex items-center justify-center',
              'h-10 w-10 rounded-full',
              'bg-white/20 text-white',
              'hover:bg-white/30 transition-colors'
            )}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={draft.image}
            alt={draft.menuName}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
