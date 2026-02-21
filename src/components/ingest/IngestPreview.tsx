import { useState } from 'react';
import { Pencil, Eye, Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { IngredientsColumn } from '@/components/recipes/IngredientsColumn';
import { ProcedureColumn } from '@/components/recipes/ProcedureColumn';
import { BatchSizeSelector } from '@/components/recipes/BatchSizeSelector';
import type { PrepRecipeDraft } from '@/types/ingestion';
import type { BatchScaling, TrainingNotes } from '@/types/products';

interface IngestPreviewProps {
  draft: PrepRecipeDraft;
  onSwitchToEdit: () => void;
}

export function IngestPreview({ draft, onSwitchToEdit }: IngestPreviewProps) {
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  if (!draft.name && draft.ingredients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Eye className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No recipe to preview</p>
        <p className="text-xs mt-1">Build a recipe in Chat first</p>
      </div>
    );
  }

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
          {draft.name || 'Untitled Recipe'}
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
        <BatchSizeSelector value={batchMultiplier} onChange={setBatchMultiplier} />
      </div>

      <div className="border-t border-border" />

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-lg md:gap-xl">
        <div className="md:w-[38%] lg:w-[35%] md:shrink-0 space-y-lg">
          {draft.ingredients.length > 0 ? (
            <IngredientsColumn
              groups={draft.ingredients}
              batchMultiplier={batchMultiplier}
            />
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
            <ProcedureColumn
              groups={draft.procedure}
              sectionLabel="Procedure"
              notes={notes}
            />
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
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
