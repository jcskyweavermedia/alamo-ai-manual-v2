import { useState, useMemo, useCallback } from 'react';
import { Pencil, Eye, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IngredientsColumn } from '@/components/recipes/IngredientsColumn';
import { ProcedureColumn } from '@/components/recipes/ProcedureColumn';
import { BatchSizeSelector } from '@/components/recipes/BatchSizeSelector';
import { EditableTranslationText } from './EditableTranslationText';
import { useProductTranslations } from '@/hooks/use-product-translations';
import { useTranslateProduct } from '@/hooks/use-translate-product';
import { extractTranslatableTexts, getFieldValue } from '@/lib/translatable-fields';
import { Callout } from '@/components/ui/callout';
import type { PrepRecipeDraft } from '@/types/ingestion';
import type { BatchScaling, TrainingNotes, RecipeProcedureGroup, RecipeIngredientGroup } from '@/types/products';

interface IngestPreviewProps {
  draft: PrepRecipeDraft;
  onSwitchToEdit: () => void;
  productId?: string | null;
}

export function IngestPreview({ draft, onSwitchToEdit, productId }: IngestPreviewProps) {
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<'en' | 'es'>('en');

  const { translations, refetch } = useProductTranslations(
    productId ? 'prep_recipes' : null,
    productId ?? null,
  );
  const { saveTranslations } = useTranslateProduct();

  if (!draft.name && draft.ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Eye className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No recipe to preview</p>
        <p className="text-xs mt-1">Build a recipe in Chat first</p>
      </div>
    );
  }

  const isEsMode = previewLang === 'es' && productId;

  // Build product data for field lookups
  const productData: Record<string, unknown> = {
    name: draft.name,
    ingredients: draft.ingredients,
    procedure: draft.procedure,
    training_notes: draft.trainingNotes,
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
    await saveTranslations('prep_recipes', productId, [
      { fieldPath, sourceText, translatedText: newText },
    ]);
    refetch();
  };

  // Display name
  const displayName = isEsMode
    ? getTranslated('name') || draft.name
    : draft.name;

  // Build notes array matching RecipeCardView pattern
  const notes: { variant: 'tip' | 'info'; title: string; text: string }[] = [];
  if ('scalable' in draft.batchScaling) {
    const bs = draft.batchScaling as BatchScaling;
    notes.push({ variant: 'info', title: 'Batch Scaling', text: bs.notes || `${bs.scaling_method} scaling` });
  }
  if ('notes' in draft.trainingNotes) {
    const tn = draft.trainingNotes as TrainingNotes;
    const parts = [tn.notes];
    if (tn.common_mistakes.length) parts.push('Common mistakes: ' + tn.common_mistakes.join('; '));
    if (tn.quality_checks.length) parts.push('Quality checks: ' + tn.quality_checks.join('; '));
    notes.push({ variant: 'tip', title: 'Training Notes', text: parts.filter(Boolean).join('\n') });
  }

  return (
    <div className="space-y-md relative">
      {/* Title + meta */}
      <div className="flex items-center gap-3">
        <h1 className="text-page-title text-foreground flex-1">
          {isEsMode ? (
            <EditableTranslationText
              fieldPath="name"
              englishText={draft.name || 'Untitled Recipe'}
              translatedText={getTranslated('name')}
              onSave={handleInlineSave}
            />
          ) : (
            draft.name || 'Untitled Recipe'
          )}
        </h1>
        <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5',
          'text-[11px] font-bold uppercase tracking-wide',
          'bg-primary/10 text-primary'
        )}>
          {draft.prepType || 'Prep'}
        </span>
        {draft.yieldQty > 0 && (
          <span className="text-xs text-muted-foreground">
            Yield: {draft.yieldQty} {draft.yieldUnit}
          </span>
        )}
        {draft.shelfLifeValue > 0 && (
          <span className="text-xs text-muted-foreground">
            Shelf life: {draft.shelfLifeValue} {draft.shelfLifeUnit}
          </span>
        )}
        <div className="flex-1" />

        {/* EN/ES toggle — only show when productId exists */}
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

        <BatchSizeSelector value={batchMultiplier} onChange={setBatchMultiplier} />
      </div>

      <div className="border-t border-border" />

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-lg md:gap-xl">
        <div className="md:w-[38%] lg:w-[35%] md:shrink-0 space-y-lg">
          {draft.ingredients.length > 0 ? (
            isEsMode ? (
              <EsIngredientsView
                groups={draft.ingredients}
                batchMultiplier={batchMultiplier}
                translations={translations}
                onSave={handleInlineSave}
              />
            ) : (
              <IngredientsColumn
                groups={draft.ingredients}
                batchMultiplier={batchMultiplier}
              />
            )
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No ingredients added yet</p>
          )}

          {/* Images below ingredients */}
          {draft.images.length > 0 && (
            <div className="space-y-2">
              {draft.images.map((img) => (
                <button
                  key={img.url}
                  type="button"
                  onClick={() => setExpandedImage(img.url)}
                  className="relative group w-full rounded-lg overflow-hidden cursor-pointer"
                >
                  <img
                    src={img.url}
                    alt={img.alt || 'Recipe image'}
                    className="w-full rounded-lg object-cover max-h-[300px]"
                    loading="lazy"
                  />
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
        <div className="flex-1 min-w-0">
          {draft.procedure.length > 0 ? (
            isEsMode ? (
              <EsProcedureView
                groups={draft.procedure}
                notes={notes}
                translations={translations}
                trainingNotes={'notes' in draft.trainingNotes ? draft.trainingNotes as TrainingNotes : null}
                onSave={handleInlineSave}
              />
            ) : (
              <ProcedureColumn
                groups={draft.procedure}
                sectionLabel="Procedure"
                notes={notes}
              />
            )
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No procedure steps yet</p>
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
            alt={draft.name || 'Recipe image'}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ES-mode Procedure View (custom rendering with inline editing)
// =============================================================================

const STEP_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

interface EsProcedureViewProps {
  groups: RecipeProcedureGroup[];
  notes: { variant: 'tip' | 'info'; title: string; text: string }[];
  translations: Map<string, { translatedText: string }>;
  trainingNotes: TrainingNotes | null;
  onSave: (fieldPath: string, newText: string) => void;
}

function EsProcedureView({ groups, notes, translations, trainingNotes, onSave }: EsProcedureViewProps) {
  return (
    <div className="space-y-md">
      <h2 className="text-section-title text-foreground">Procedure</h2>

      {groups.map((group, gi) => (
        <div
          key={gi}
          className={cn(
            'rounded-card border border-border/60 overflow-hidden',
            'bg-card dark:bg-card'
          )}
        >
          {/* Group header */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 border-b border-border/40">
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                'w-7 h-7 rounded-full',
                'text-xs font-bold',
                'bg-slate-400 text-white dark:bg-slate-500'
              )}
            >
              {gi + 1}
            </span>
          </div>

          {/* Steps */}
          <div className="px-3 py-2 space-y-0">
            {group.steps.map((step, si) => {
              const fieldPath = `procedure[${gi}].steps[${si}].instruction`;
              const translated = translations.get(fieldPath)?.translatedText ?? null;

              return (
                <div
                  key={si}
                  className={cn(
                    'flex gap-2.5 py-1.5',
                    step.critical && 'bg-destructive/[0.06] -mx-3 px-3 border-l-[3px] border-destructive'
                  )}
                >
                  <span
                    className={cn(
                      'shrink-0 w-5 text-xs font-semibold pt-0.5 text-right',
                      step.critical ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {STEP_LETTERS[si]}.
                  </span>
                  <span className="flex-1 text-sm text-foreground leading-relaxed">
                    {step.critical && (
                      <span className="inline-block text-[14px] leading-none mr-1 -mt-0.5">&#9888;&#65039;</span>
                    )}
                    <EditableTranslationText
                      fieldPath={fieldPath}
                      englishText={step.instruction}
                      translatedText={translated}
                      onSave={onSave}
                    />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Training notes in ES mode */}
      {trainingNotes && (
        <EsTrainingNotesView trainingNotes={trainingNotes} translations={translations} onSave={onSave} />
      )}
    </div>
  );
}

// =============================================================================
// ES-mode Training Notes View
// =============================================================================

interface EsTrainingNotesViewProps {
  trainingNotes: TrainingNotes;
  translations: Map<string, { translatedText: string }>;
  onSave: (fieldPath: string, newText: string) => void;
}

function EsTrainingNotesView({ trainingNotes, translations, onSave }: EsTrainingNotesViewProps) {
  const notesTranslated = translations.get('training_notes.notes')?.translatedText ?? null;

  // Build display parts
  const parts: string[] = [];

  if (notesTranslated) {
    parts.push(notesTranslated);
  } else if (trainingNotes.notes) {
    parts.push(trainingNotes.notes);
  }

  return (
    <Callout variant="tip" title="Training Notes">
      <div className="space-y-2">
        {/* Main notes */}
        {trainingNotes.notes && (
          <div>
            <EditableTranslationText
              fieldPath="training_notes.notes"
              englishText={trainingNotes.notes}
              translatedText={notesTranslated}
              onSave={onSave}
            />
          </div>
        )}

        {/* Common mistakes */}
        {trainingNotes.common_mistakes.length > 0 && (
          <div>
            <span className="text-xs font-semibold">Common mistakes: </span>
            {trainingNotes.common_mistakes.map((m, i) => {
              const fp = `training_notes.common_mistakes[${i}]`;
              const translated = translations.get(fp)?.translatedText ?? null;
              return (
                <span key={i}>
                  {i > 0 && '; '}
                  <EditableTranslationText
                    fieldPath={fp}
                    englishText={m}
                    translatedText={translated}
                    onSave={onSave}
                  />
                </span>
              );
            })}
          </div>
        )}

        {/* Quality checks */}
        {trainingNotes.quality_checks.length > 0 && (
          <div>
            <span className="text-xs font-semibold">Quality checks: </span>
            {trainingNotes.quality_checks.map((q, i) => {
              const fp = `training_notes.quality_checks[${i}]`;
              const translated = translations.get(fp)?.translatedText ?? null;
              return (
                <span key={i}>
                  {i > 0 && '; '}
                  <EditableTranslationText
                    fieldPath={fp}
                    englishText={q}
                    translatedText={translated}
                    onSave={onSave}
                  />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Callout>
  );
}

// =============================================================================
// ES-mode Ingredients View (custom rendering with inline editing)
// =============================================================================

interface EsIngredientsViewProps {
  groups: RecipeIngredientGroup[];
  batchMultiplier: number;
  translations: Map<string, { translatedText: string }>;
  onSave: (fieldPath: string, newText: string) => void;
}

function EsIngredientsView({ groups, batchMultiplier, translations, onSave }: EsIngredientsViewProps) {
  return (
    <div className="space-y-md">
      <h2 className="text-section-title text-foreground">Ingredients</h2>

      {groups.map((group, gi) => (
        <div key={gi}>
          <div className="flex items-center gap-2 mb-xs">
            <span
              className={cn(
                'flex items-center justify-center shrink-0',
                'w-6 h-6 rounded-full',
                'text-[11px] font-bold',
                'bg-slate-400 text-white dark:bg-slate-500'
              )}
            >
              {gi + 1}
            </span>
          </div>
          <ul className="space-y-0">
            {group.items.map((item, ii) => {
              const fieldPath = `ingredients[${gi}].items[${ii}].name`;
              const translated = translations.get(fieldPath)?.translatedText ?? null;
              const qty = item.quantity * batchMultiplier;

              return (
                <li key={ii} className="flex items-baseline gap-2 py-1 text-sm">
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {qty % 1 === 0 ? qty : qty.toFixed(2)} {item.unit}
                  </span>
                  <EditableTranslationText
                    fieldPath={fieldPath}
                    englishText={item.name}
                    translatedText={translated}
                    onSave={onSave}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
