import { useState } from 'react';
import { Pencil, Eye, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AllergenBadge } from '@/components/recipes/AllergenBadge';
import { LinkedItemRow } from '@/components/recipes/LinkedItemRow';
import { ProcedureColumn } from '@/components/recipes/ProcedureColumn';
import { useProductTranslations } from '@/hooks/use-product-translations';
import { useTranslateProduct } from '@/hooks/use-translate-product';
import { EditableTranslationText } from './EditableTranslationText';
import { getFieldValue } from '@/lib/translatable-fields';
import type { PlateSpecDraft } from '@/types/ingestion';

interface PlateSpecIngestPreviewProps {
  draft: PlateSpecDraft;
  onSwitchToEdit: () => void;
  productId?: string | null;
}

export function PlateSpecIngestPreview({ draft, onSwitchToEdit, productId }: PlateSpecIngestPreviewProps) {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>('en');

  const { translations, refetch } = useProductTranslations(
    productId ? 'plate_specs' : null,
    productId ?? null,
  );
  const { saveTranslations } = useTranslateProduct();

  if (!draft.name && draft.components.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Eye className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No plate spec to preview</p>
        <p className="text-xs mt-1">Build a plate spec in Chat first</p>
      </div>
    );
  }

  const isEsMode = previewLang === 'es' && productId;

  // Build product data for field lookups
  const productData: Record<string, unknown> = {
    name: draft.name,
    components: draft.components,
    assembly_procedure: draft.assemblyProcedure,
    notes: draft.notes,
  };

  // Helper: get translated text for a field path
  const getTranslated = (fieldPath: string): string | null => {
    const row = translations.get(fieldPath);
    return row ? row.translatedText : null;
  };

  // Save inline edit
  const handleInlineSave = async (fieldPath: string, newText: string) => {
    if (!productId) return;
    const sourceText = getFieldValue(productData, fieldPath) ?? '';
    await saveTranslations('plate_specs', productId, [
      { fieldPath, sourceText, translatedText: newText },
    ]);
    refetch();
  };

  // Collect images for gallery
  const images = draft.images.map(img => img.url);

  // Build notes array for ProcedureColumn
  const notes: { variant: 'tip' | 'info'; title: string; text: string }[] = [];
  if (draft.notes) notes.push({ variant: 'tip', title: 'Plating Notes', text: draft.notes });

  return (
    <div className="space-y-md relative">
      {/* Title + edit button */}
      <div className="flex items-center gap-3">
        <h1 className="text-page-title text-foreground flex-1">
          {isEsMode ? (
            <EditableTranslationText
              fieldPath="name"
              englishText={draft.name || 'Untitled Plate Spec'}
              translatedText={getTranslated('name')}
              onSave={handleInlineSave}
            />
          ) : (
            draft.name || 'Untitled Plate Spec'
          )}
        </h1>
        <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.plateType && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              'bg-amber-500 text-white dark:bg-amber-600'
            )}>
              {draft.plateType}
            </span>
          )}
          {draft.menuCategory && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              'bg-primary/10 text-primary'
            )}>
              {draft.menuCategory}
            </span>
          )}
          {draft.allergens.map(a => (
            <AllergenBadge key={a} allergen={a as any} />
          ))}
        </div>

        <div className="flex-1" />

        {/* EN/ES toggle -- only show when productId exists */}
        {productId && (
          <div className="inline-flex rounded-full border border-border overflow-hidden">
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

      <div className="border-t border-border" />

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-lg md:gap-xl">
        {/* Left column -- components */}
        <div className="md:w-[38%] lg:w-[35%] md:shrink-0 space-y-lg">
          {draft.components.length > 0 ? (
            <div className="space-y-md">
              <h2 className="text-section-title text-foreground">Components</h2>

              {draft.components.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-xs">
                    <span className={cn(
                      'flex items-center justify-center shrink-0',
                      'w-6 h-6 rounded-full',
                      'text-[11px] font-bold',
                      'bg-slate-400 text-white dark:bg-slate-500'
                    )}>
                      {gi + 1}
                    </span>
                    {group.group_name && (
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {group.group_name}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-0">
                    {group.items.map((comp, ci) => (
                      <li key={ci}>
                        <LinkedItemRow
                          name={comp.name}
                          quantity={comp.quantity}
                          unit={comp.unit}
                          prepRecipeRef={comp.prep_recipe_ref}
                          allergens={comp.allergens}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No components added yet</p>
          )}

          {/* Images below components */}
          {images.length > 0 && (
            <div className="space-y-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExpandedImage(src)}
                  className="relative group w-full rounded-[20px] overflow-hidden cursor-pointer shadow-[6px_14px_24px_-6px_rgba(0,0,0,0.4),3px_8px_14px_-3px_rgba(0,0,0,0.25)]"
                >
                  <div className="aspect-[16/10]">
                    <img
                      src={src}
                      alt={`${draft.name} - ${i + 1}`}
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
              ))}
            </div>
          )}
        </div>

        {/* Right column -- assembly procedure */}
        <div className="flex-1 min-w-0">
          {draft.assemblyProcedure.length > 0 ? (
            <ProcedureColumn
              groups={draft.assemblyProcedure}
              sectionLabel="Plating"
              notes={notes}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No assembly steps yet</p>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
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
            src={expandedImage}
            alt={draft.name || 'Plate spec image'}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
