import { useState } from 'react';
import { ArrowLeft, Expand, X, Mic, Play, UtensilsCrossed, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WineStyleBadge } from './WineStyleBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { WineAISheet } from './WineAISheet';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Wine, WineBody } from '@/types/products';
import type { WineAIAction } from '@/data/mock-wines';
import { WINE_AI_ACTIONS } from '@/data/mock-wines';

interface WineCardViewProps {
  wine: Wine;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

function BodyIndicator({ body }: { body: WineBody }) {
  const filled = body === 'light' ? 1 : body === 'medium' ? 2 : 3;
  const label = body.charAt(0).toUpperCase() + body.slice(1);

  return (
    <span className="inline-flex items-center gap-1.5">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            i <= filled ? 'bg-foreground' : 'bg-border'
          )}
        />
      ))}
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

export function WineCardView({ wine, onBack, onPrev, onNext }: WineCardViewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<WineAIAction | null>(null);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled: !lightboxOpen && activeAction === null,
  });

  const vintageLabel = wine.vintage ?? 'NV';

  return (
    <div ref={swipeRef} className="md:h-[calc(100vh-theme(spacing.14)-theme(spacing.8))] md:flex md:flex-col">
      {/* Header */}
      <div className="space-y-1 mb-3 md:mb-2 shrink-0">
        {/* Title row */}
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
            title="All Wines"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-page-title text-foreground flex-1 min-w-0 truncate">
            {wine.name}
          </h1>
          <WineStyleBadge style={wine.style} />
          {wine.isTopSeller && <TopSellerBadge size="md" />}
        </div>

        {/* Sub-meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-sm text-muted-foreground">
          <span>{wine.producer}</span>
          <span className="text-border">·</span>
          <span>{wine.region}, {wine.country}</span>
          <span className="text-border">·</span>
          <span>{vintageLabel}</span>
        </div>

        {/* Grape + body row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[52px]">
          <span className="text-sm text-foreground">{wine.varietal}</span>
          <span className="text-border">·</span>
          <BodyIndicator body={wine.body} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-4 md:mb-3 shrink-0" />

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-2 mb-5 md:mb-4 shrink-0 overflow-x-auto">
        {WINE_AI_ACTIONS.map(({ key, label, icon }) => {
          const Icon = { mic: Mic, play: Play, 'utensils-crossed': UtensilsCrossed, 'help-circle': HelpCircle }[icon];
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

      {/* Two-column layout (md+) / stacked (mobile) */}
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 md:flex-1 md:min-h-0">
        {/* Left column — bottle image */}
        <div className="md:w-[35%] lg:w-[30%] md:shrink-0">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="relative group w-full rounded-lg overflow-hidden cursor-pointer bg-muted"
          >
            <div className="aspect-[2/3] max-h-48 md:max-h-none">
              <img
                src={wine.image}
                alt={wine.name}
                className="w-full h-full object-contain"
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
          {/* Tasting Notes */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Tasting Notes
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-8">
              {wine.tastingNotes}
            </p>
          </section>

          {/* Producer Notes */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Producer Notes
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-6">
              {wine.producerNotes}
            </p>
          </section>

          {/* Notes (pairing, service) */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Notes
            </h2>
            <p className="text-sm leading-snug text-foreground md:line-clamp-4">
              {wine.notes}
            </p>
          </section>
        </div>
      </div>

      {/* AI Response Sheet */}
      <WineAISheet
        wine={wine}
        action={activeAction}
        open={activeAction !== null}
        onOpenChange={(open) => { if (!open) setActiveAction(null); }}
      />

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
            src={wine.image}
            alt={wine.name}
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
