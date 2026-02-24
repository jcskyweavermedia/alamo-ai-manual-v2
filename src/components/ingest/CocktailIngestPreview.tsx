import { useState } from 'react';
import { Pencil, Eye, Expand, X, GlassWater } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CocktailStyleBadge } from '@/components/cocktails/CocktailStyleBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import type { CocktailDraft } from '@/types/ingestion';
import type { CocktailStyle } from '@/types/products';

interface CocktailIngestPreviewProps {
  draft: CocktailDraft;
  onSwitchToEdit: () => void;
}

export function CocktailIngestPreview({ draft, onSwitchToEdit }: CocktailIngestPreviewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  if (!draft.name) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <GlassWater className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No cocktail to preview</p>
        <p className="text-xs mt-1">Build a cocktail entry in Chat first</p>
      </div>
    );
  }

  return (
    <div className="space-y-md relative">
      {/* Title + edit button */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <CocktailStyleBadge style={draft.style as CocktailStyle} variant="text" />
          <h1 className="text-page-title text-foreground truncate">
            {draft.name || 'Untitled Cocktail'}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={onSwitchToEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      {/* Top seller badge */}
      {draft.isTopSeller && <TopSellerBadge size="md" />}

      {/* Sub-meta row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        {draft.keyIngredients && <span>{draft.keyIngredients}</span>}
        {draft.keyIngredients && draft.glass && <span className="text-border">&middot;</span>}
        {draft.glass && <span>{draft.glass} glass</span>}
      </div>

      <div className="border-t border-border" />

      {/* Two-column layout */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Left column -- cocktail image */}
        <div className="md:w-[35%] lg:w-[30%] md:shrink-0">
          {draft.image ? (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="relative group w-full rounded-lg overflow-hidden cursor-pointer bg-muted"
            >
              <div className="aspect-[3/4] max-h-48 md:max-h-none">
                <img
                  src={draft.image}
                  alt={draft.name || 'Cocktail image'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <span
                className={cn(
                  'absolute bottom-2 right-2',
                  'flex items-center justify-center',
                  'h-7 w-7 rounded-md',
                  'bg-black/50 text-white',
                  'opacity-70 group-hover:opacity-100 transition-opacity'
                )}
              >
                <Expand className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <div className="aspect-[3/4] max-h-48 md:max-h-none rounded-lg bg-muted flex items-center justify-center">
              <span className="text-xs text-muted-foreground">No image</span>
            </div>
          )}
        </div>

        {/* Right column -- info sections */}
        <div className="flex-1 min-w-0 space-y-3">
          {draft.ingredients && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Ingredients
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.ingredients}
              </p>
            </section>
          )}
          {draft.procedure.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Method
              </h2>
              <ol className="text-sm leading-snug text-foreground space-y-1">
                {draft.procedure.map(({ step, instruction }) => (
                  <li key={step} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-muted-foreground">{step}.</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {draft.tastingNotes && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Tasting Notes
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.tastingNotes}
              </p>
            </section>
          )}
          {draft.description && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Description
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.description}
              </p>
            </section>
          )}
          {draft.notes && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
                Notes
              </h2>
              <p className="text-sm leading-snug text-foreground whitespace-pre-wrap">
                {draft.notes}
              </p>
            </section>
          )}
          {!draft.ingredients && draft.procedure.length === 0 && !draft.tastingNotes && !draft.description && !draft.notes && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No cocktail details yet
            </p>
          )}
        </div>
      </div>

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
            alt={draft.name || 'Cocktail image'}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
