import { useState } from 'react';
import { ArrowLeft, Clock, Expand, FileText, Package, X, GraduationCap, ClipboardList, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllergenBadge } from './AllergenBadge';
import { BatchSizeSelector } from './BatchSizeSelector';
import { IngredientsColumn } from './IngredientsColumn';
import { ProcedureColumn } from './ProcedureColumn';
import { RecipeAISheet } from './RecipeAISheet';
import { Button } from '@/components/ui/button';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Recipe, PrepRecipe, PlateSpec, BatchScaling, TrainingNotes } from '@/types/products';
import type { RecipeAIAction } from '@/data/mock-recipes';
import { RECIPE_AI_ACTIONS } from '@/data/mock-recipes';

const AI_ICON_MAP: Record<string, typeof GraduationCap> = {
  'graduation-cap': GraduationCap,
  'clipboard-list': ClipboardList,
  'help-circle': HelpCircle,
};

interface RecipeCardViewProps {
  recipe: Recipe;
  batchMultiplier: number;
  onBatchChange: (multiplier: number) => void;
  onBack: () => void;
  backLabel?: string;
  onTapPrepRecipe?: (slug: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function RecipeCardView({
  recipe,
  batchMultiplier,
  onBatchChange,
  onBack,
  backLabel,
  onTapPrepRecipe,
  onPrev,
  onNext,
}: RecipeCardViewProps) {
  const isPrep = recipe.type === 'prep';
  const prep = isPrep ? (recipe as PrepRecipe) : null;
  const plate = !isPrep ? (recipe as PlateSpec) : null;

  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<RecipeAIAction | null>(null);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled: !expandedImage && activeAction === null,
  });

  const notes: { variant: 'tip' | 'info'; title: string; text: string }[] = [];
  if (prep?.batchScaling && 'scalable' in prep.batchScaling) {
    const bs = prep.batchScaling as BatchScaling;
    notes.push({ variant: 'info', title: 'Batch Scaling', text: bs.notes || `${bs.scaling_method} scaling` });
  }
  if (prep?.trainingNotes && 'notes' in prep.trainingNotes) {
    const tn = prep.trainingNotes as TrainingNotes;
    const parts = [tn.notes];
    if (tn.common_mistakes.length) parts.push('Common mistakes: ' + tn.common_mistakes.join('; '));
    if (tn.quality_checks.length) parts.push('Quality checks: ' + tn.quality_checks.join('; '));
    notes.push({ variant: 'tip', title: 'Training Notes', text: parts.filter(Boolean).join('\n') });
  }
  if (plate?.notes) notes.push({ variant: 'tip', title: 'Plating Notes', text: plate.notes });

  // Collect images for the gallery below ingredients
  const images = recipe.images.map(img => img.url);

  return (
    <div ref={swipeRef} className="space-y-md">
      {/* Title row with solid back button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'flex items-center justify-center shrink-0',
            'h-10 w-10 rounded-lg',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 active:bg-primary/80',
            'shadow-sm transition-colors duration-150'
          )}
          title={backLabel ?? 'All Recipes'}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-page-title text-foreground">{recipe.name}</h1>
      </div>

      {/* Meta row: left info + right-anchored batch selector */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              isPrep
                ? 'bg-primary/10 text-primary'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            )}
          >
            {isPrep ? 'Prep' : plate!.plateType}
          </span>
          {recipe.type === 'plate' && recipe.allergens.map(a => (
            <AllergenBadge key={a} allergen={a as any} />
          ))}
        </div>

        {prep && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3.5 w-3.5" />
              {prep.yieldQty} {prep.yieldUnit}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {prep.shelfLifeValue} {prep.shelfLifeUnit}
            </span>
          </div>
        )}

        {/* Spacer pushes batch selector to the right */}
        <div className="flex-1" />

        {prep && (
          <BatchSizeSelector value={batchMultiplier} onChange={onBatchChange} />
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {RECIPE_AI_ACTIONS.map(({ key, label, icon }) => {
          const Icon = AI_ICON_MAP[icon];
          const isActive = activeAction === key;
          return (
            <Button
              key={key}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="shrink-0"
              onClick={() => setActiveAction(isActive ? null : key)}
            >
              {Icon && <Icon className={cn('h-4 w-4', !isActive && 'text-primary')} />}
              {label}
            </Button>
          );
        })}
      </div>

      {/* Two-column layout: Ingredients/Components | Procedure/Plating */}
      <div className="flex flex-col md:flex-row gap-lg md:gap-xl">
        {/* Left column */}
        <div className="md:w-[38%] lg:w-[35%] md:shrink-0 space-y-lg">
          {prep ? (
            <IngredientsColumn
              groups={prep.ingredients}
              batchMultiplier={batchMultiplier}
              onTapPrepRecipe={onTapPrepRecipe}
            />
          ) : plate ? (
            <div className="space-y-md">
              <h2 className="text-section-title text-foreground">Components</h2>

              {plate.components.map((group, gi) => (
                <div key={gi}>
                  <div className="flex items-center gap-2 mb-xs">
                    <span
                      className={cn(
                        'flex items-center justify-center shrink-0',
                        'w-6 h-6 rounded-full',
                        'text-[11px] font-bold',
                        'bg-primary text-primary-foreground'
                      )}
                    >
                      {gi + 1}
                    </span>
                  </div>
                  <ul className="space-y-0">
                    {group.items.map((comp, ci) => {
                      const isLinked = !!comp.prep_recipe_ref;
                      const Row = isLinked ? 'button' : 'div';

                      return (
                        <li key={ci}>
                          <Row
                            {...(isLinked ? {
                              type: 'button' as const,
                              onClick: () => onTapPrepRecipe?.(comp.prep_recipe_ref!),
                            } : {})}
                            className={cn(
                              'flex items-baseline gap-2 py-1 px-1 text-sm w-full text-left',
                              isLinked && 'rounded-lg cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors'
                            )}
                          >
                            {(comp.quantity || comp.unit) ? (
                              <span className="font-mono text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums">
                                {comp.quantity} {comp.unit}
                              </span>
                            ) : (
                              <span className="shrink-0 w-16" />
                            )}
                            <span className="flex-1 text-foreground">
                              {comp.name}
                              {isLinked && (
                                <FileText className="inline-block h-3.5 w-3.5 text-muted-foreground ml-1.5 -mt-0.5" />
                              )}
                            </span>
                          </Row>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}

          {/* Images below ingredients */}
          {images.length > 0 && (
            <div className="space-y-2">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExpandedImage(src)}
                  className="relative group w-full rounded-lg overflow-hidden cursor-pointer"
                >
                  <img
                    src={src}
                    alt={`${recipe.name} - ${i + 1}`}
                    className="w-full rounded-lg object-cover"
                    style={{ maxHeight: 200 }}
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

        {/* Right column */}
        <div className="flex-1 min-w-0">
          <ProcedureColumn
            groups={prep ? prep.procedure : plate!.assemblyProcedure}
            sectionLabel={plate ? 'Plating' : 'Procedure'}
            notes={notes}
          />
        </div>
      </div>

      {/* AI Response Sheet */}
      <RecipeAISheet
        recipe={recipe}
        action={activeAction}
        open={activeAction !== null}
        onOpenChange={(open) => { if (!open) setActiveAction(null); }}
      />

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
            alt={recipe.name}
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
