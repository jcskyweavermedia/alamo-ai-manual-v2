import { useState } from 'react';
import { Expand, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { WineStyleBadge } from './WineStyleBadge';
import { BodyIndicator } from './BodyIndicator';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Wine } from '@/types/products';
import { PRODUCT_AI_ACTIONS } from '@/data/ai-action-config';
import { AI_ACTION_ICONS } from '@/data/ai-action-icons';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';

interface WineCardViewProps {
  wine: Wine;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
}

export function WineCardView({ wine, onBack, onPrev, onNext, activeAction, onActionChange }: WineCardViewProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);

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
        {/* Style label + title row */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <WineStyleBadge style={wine.style} variant="text" />
            <h1 className="text-page-title text-foreground truncate">
              {wine.name}
            </h1>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/ingest/edit/wines/${wine.id}`); }}
              title="Edit product"
            >
              <span className="text-[14px] leading-none">✏️</span>
            </Button>
          )}
        </div>

        {/* Top seller / Featured badges */}
        {(wine.isTopSeller || wine.isFeatured) && (
          <div className="flex items-center gap-3">
            {wine.isTopSeller && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                <span className="text-[16px] h-[16px] leading-[16px]">⭐</span>
                <span>Top Seller</span>
              </div>
            )}
            {wine.isFeatured && (
              <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <span className="text-[16px] h-[16px] leading-[16px]">✨</span>
                <span>Featured</span>
              </div>
            )}
          </div>
        )}

        {/* Sub-meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{wine.producer}</span>
          <span className="text-border">·</span>
          <span>{wine.region}, {wine.country}</span>
          <span className="text-border">·</span>
          <span>{vintageLabel}</span>
        </div>

        {/* Grape + body row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm text-foreground">{wine.varietal}</span>
          <span className="text-border">·</span>
          <BodyIndicator body={wine.body} />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-4 md:mb-3 shrink-0" />

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-2 mb-5 md:mb-4 flex-wrap">
        {PRODUCT_AI_ACTIONS.wines.map(({ key, label, icon }) => {
          const Icon = AI_ACTION_ICONS[icon];
          const isActive = activeAction === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onActionChange(isActive ? null : key)}
              className={cn(
                'flex items-center gap-1.5',
                'h-10 px-2.5 rounded-xl',
                'text-[12px] font-medium',
                'transition-all duration-150',
                'active:scale-[0.97]',
                isActive
                  ? 'bg-orange-400 text-white shadow-sm'
                  : 'bg-card text-foreground shadow-sm hover:shadow-md'
              )}
            >
              {Icon && (
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-orange-500')} />
              )}
              <span>{label}</span>
            </button>
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
            className="relative group w-full rounded-[20px] overflow-hidden cursor-pointer bg-muted shadow-[6px_14px_24px_-6px_rgba(0,0,0,0.4),3px_8px_14px_-3px_rgba(0,0,0,0.25)]"
          >
            <div className="aspect-[2/3] max-h-48 md:max-h-none">
              <img
                src={wine.image ?? ''}
                alt={wine.name}
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

        {/* Right column — info cards */}
        <div className="flex-1 min-w-0 space-y-3 md:overflow-y-auto">
          {/* Tasting Notes */}
          {wine.tastingNotes && (
            <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
              <span className={cn(
                'absolute top-3 right-3',
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-red-100 dark:bg-red-900/30'
              )}>
                <span className="text-[22px] h-[22px] leading-[22px]">🍷</span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Tasting Notes
              </h2>
              <p className="text-sm leading-relaxed text-foreground">
                {wine.tastingNotes}
              </p>
            </div>
          )}

          {/* Producer Fun Facts */}
          {wine.producerNotes && (
            <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
              <span className={cn(
                'absolute top-3 right-3',
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-amber-100 dark:bg-amber-900/30'
              )}>
                <span className="text-[22px] h-[22px] leading-[22px]">🏰</span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Producer Fun Facts
              </h2>
              <p className="text-sm leading-relaxed text-foreground">
                {wine.producerNotes}
              </p>
            </div>
          )}

          {/* Notes */}
          {wine.notes && (
            <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
              <span className={cn(
                'absolute top-3 right-3',
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-green-100 dark:bg-green-900/30'
              )}>
                <span className="text-[22px] h-[22px] leading-[22px]">📝</span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                Notes
              </h2>
              <p className="text-sm leading-relaxed text-foreground">
                {wine.notes}
              </p>
            </div>
          )}
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
            src={wine.image ?? ''}
            alt={wine.name}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
