import { useState } from 'react';
import { ArrowLeft, Expand, X, Mic, Play, GraduationCap, UtensilsCrossed, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CocktailStyleBadge } from './CocktailStyleBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Cocktail } from '@/types/products';
import { PRODUCT_AI_ACTIONS } from '@/data/ai-action-config';

interface CocktailCardViewProps {
  cocktail: Cocktail;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
}

export function CocktailCardView({ cocktail, onBack, onPrev, onNext, activeAction, onActionChange }: CocktailCardViewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled: !lightboxOpen && activeAction === null,
  });

  return (
    <div ref={swipeRef} className="md:h-[calc(100vh-theme(spacing.14)-theme(spacing.8))] md:flex md:flex-col">
      {/* Header */}
      <div className="space-y-1 mb-3 md:mb-2 shrink-0">
        {/* Style label + title row */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'flex items-center justify-center shrink-0',
              'h-10 w-10 rounded-lg',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 active:bg-primary/80',
              'shadow-sm transition-colors duration-150',
              'mt-0.5'
            )}
            title="All Cocktails"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <CocktailStyleBadge style={cocktail.style} variant="text" />
            <h1 className="text-page-title text-foreground truncate">
              {cocktail.name}
            </h1>
          </div>
        </div>

        {/* Top seller badge */}
        {cocktail.isTopSeller && (
          <div className="pl-[52px]">
            <TopSellerBadge size="md" />
          </div>
        )}

        {/* Sub-meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-sm text-muted-foreground">
          <span>{cocktail.keyIngredients}</span>
          <span className="text-border">&middot;</span>
          <span>{cocktail.glass} glass</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-4 md:mb-3 shrink-0" />

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-1.5 mb-5 md:mb-4 overflow-x-auto ai-action-scroll">
        {PRODUCT_AI_ACTIONS.cocktails.map(({ key, label, icon }) => {
          const Icon = { mic: Mic, play: Play, 'graduation-cap': GraduationCap, 'utensils-crossed': UtensilsCrossed, 'help-circle': HelpCircle }[icon] as typeof Mic | undefined;
          const isActive = activeAction === key;
          return (
            <Button
              key={key}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 h-8 px-2 text-[11px] min-h-0"
              onClick={() => onActionChange(isActive ? null : key)}
            >
              {Icon && <Icon className={cn('h-3.5 w-3.5', !isActive && 'text-primary')} />}
              {label}
            </Button>
          );
        })}
      </div>

      {/* Two-column layout (md+) / stacked (mobile) */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* Left column — cocktail image (wider than wine viewer) */}
        <div className="md:w-[40%] lg:w-[35%] md:shrink-0">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group w-full rounded-lg overflow-hidden cursor-pointer bg-muted"
          >
            <div className="aspect-[3/4] max-h-64 md:max-h-none">
              <img
                src={cocktail.image}
                alt={cocktail.name}
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
        </div>

        {/* Right column — info sections */}
        <div className="flex-1 min-w-0 space-y-3 md:space-y-2 md:overflow-hidden">
          {/* Ingredients */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Ingredients
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-4">
              {cocktail.ingredients}
            </p>
          </section>

          {/* Method */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Method
            </h2>
            <ol className="text-sm leading-snug text-foreground space-y-1 md:line-clamp-8">
              {cocktail.procedure.map(({ step, instruction }) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-muted-foreground">{step}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Tasting Notes */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Tasting Notes
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-4">
              {cocktail.tastingNotes}
            </p>
          </section>

          {/* Notes */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Notes
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-4">
              {cocktail.notes}
            </p>
          </section>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
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
            src={cocktail.image}
            alt={cocktail.name}
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
