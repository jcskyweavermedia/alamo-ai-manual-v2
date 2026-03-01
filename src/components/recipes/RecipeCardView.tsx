import { useState } from 'react';
import { Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AllergenBadge } from './AllergenBadge';
import { BatchSizeSelector } from './BatchSizeSelector';
import { IngredientsColumn } from './IngredientsColumn';
import { LinkedItemRow } from './LinkedItemRow';
import { ProcedureColumn } from './ProcedureColumn';
import { Button } from '@/components/ui/button';
import { CrossNavButton } from '@/components/shared/CrossNavButton';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Recipe, PrepRecipe, PlateSpec, BatchScaling, TrainingNotes } from '@/types/products';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { HiQuestionMarkCircle } from 'react-icons/hi2';

interface RecipeCardViewProps {
  recipe: Recipe;
  batchMultiplier: number;
  onBatchChange: (multiplier: number) => void;
  onBack: () => void;
  backLabel?: string;
  onTapPrepRecipe?: (slug: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  fohSlug?: string | null;
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
  activeAction,
  onActionChange,
  fohSlug,
}: RecipeCardViewProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const isPrep = recipe.type === 'prep';
  const prep = isPrep ? (recipe as PrepRecipe) : null;
  const plate = !isPrep ? (recipe as PlateSpec) : null;

  const [expandedImage, setExpandedImage] = useState<string | null>(null);

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
      {/* Title row */}
      <div className="flex items-center gap-3">
        <h1 className="text-page-title text-foreground flex-1">{recipe.name}</h1>

        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/ingest/edit/${recipe.type === 'prep' ? 'prep_recipes' : 'plate_specs'}/${recipe.id}`); }}
            title="Edit product"
          >
            <span className="text-[14px] leading-none">✏️</span>
          </Button>
        )}

        {/* Ask a Question — plate specs: far right of title row */}
        {plate && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'shrink-0',
              activeAction === 'questions' && 'bg-orange-400 text-white border-orange-400 hover:bg-orange-400 hover:text-white'
            )}
            onClick={() => onActionChange(activeAction === 'questions' ? null : 'questions')}
          >
            <HiQuestionMarkCircle className="w-4 h-4 text-orange-500" />
            Ask a question
          </Button>
        )}
      </div>

      {/* Featured badge */}
      {recipe.isFeatured && (
        <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <span className="text-[16px] h-[16px] leading-[16px]">✨</span>
          <span>Featured</span>
        </div>
      )}

      {/* Meta row: left info + right-anchored batch selector */}
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              isPrep
                ? 'bg-[#2aa962] text-white'
                : 'bg-amber-500 text-white dark:bg-amber-600'
            )}
          >
            {isPrep ? 'Prep' : plate!.plateType}
          </span>
          {recipe.type === 'plate' && recipe.allergens.map(a => (
            <AllergenBadge key={a} allergen={a as any} />
          ))}
        </div>

        {prep && (
          <div className="flex items-center gap-3 text-xs leading-none text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[16px] h-[16px] leading-[16px] shrink-0">📦</span>
              {prep.yieldQty} {prep.yieldUnit}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[16px] h-[16px] leading-[16px] shrink-0">🕐</span>
              {prep.shelfLifeValue} {prep.shelfLifeUnit}
            </span>
          </div>
        )}

        {/* Spacer pushes buttons to the right */}
        <div className="flex-1" />

        {/* Cross-nav: BOH → FOH (right side of meta row) */}
        {recipe.type === 'plate' && fohSlug && (
          <CrossNavButton
            label="View FOH Plate Spec"
            targetPath="/dish-guide"
            targetSlug={fohSlug}
          />
        )}

        {/* Ask a Question — prep recipes: left of batch calculator */}
        {prep && (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'shrink-0',
              activeAction === 'questions' && 'bg-orange-400 text-white border-orange-400 hover:bg-orange-400 hover:text-white'
            )}
            onClick={() => onActionChange(activeAction === 'questions' ? null : 'questions')}
          >
            <HiQuestionMarkCircle className="w-4 h-4 text-orange-500" />
            Ask a question
          </Button>
        )}

        {prep && (
          <BatchSizeSelector value={batchMultiplier} onChange={onBatchChange} />
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* AI action buttons removed — "Ask a question" is now inline in title/meta row */}

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
                        'bg-slate-400 text-white dark:bg-slate-500'
                      )}
                    >
                      {gi + 1}
                    </span>
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
                          onTapPrepRecipe={onTapPrepRecipe}
                        />
                      </li>
                    ))}
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
                  className="relative group w-full rounded-[20px] overflow-hidden cursor-pointer shadow-[6px_14px_24px_-6px_rgba(0,0,0,0.4),3px_8px_14px_-3px_rgba(0,0,0,0.25)]"
                >
                  <div className="aspect-[16/10]">
                    <img
                      src={src}
                      alt={`${recipe.name} - ${i + 1}`}
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

        {/* Right column */}
        <div className="flex-1 min-w-0">
          <ProcedureColumn
            groups={prep ? prep.procedure : plate!.assemblyProcedure}
            sectionLabel={plate ? 'Plating' : 'Procedure'}
            notes={notes}
          />
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
            alt={recipe.name}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
