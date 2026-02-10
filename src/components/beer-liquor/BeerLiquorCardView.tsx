import { useState } from 'react';
import { ArrowLeft, GraduationCap, UtensilsCrossed, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BeerLiquorSubcategoryBadge } from './BeerLiquorSubcategoryBadge';
import { BeerLiquorAISheet } from './BeerLiquorAISheet';
import { Button } from '@/components/ui/button';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { BeerLiquorItem } from '@/types/products';
import type { BeerLiquorSubcategory, BeerLiquorAIAction } from '@/data/mock-beer-liquor';
import { BEER_LIQUOR_AI_ACTIONS } from '@/data/mock-beer-liquor';

const AI_ICON_MAP: Record<string, typeof GraduationCap> = {
  'graduation-cap': GraduationCap,
  'utensils-crossed': UtensilsCrossed,
  'help-circle': HelpCircle,
};

interface BeerLiquorCardViewProps {
  item: BeerLiquorItem;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

export function BeerLiquorCardView({ item, onBack, onPrev, onNext }: BeerLiquorCardViewProps) {
  const [activeAction, setActiveAction] = useState<BeerLiquorAIAction | null>(null);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled: activeAction === null,
  });

  return (
    <div ref={swipeRef} className="space-y-md">
      {/* Header */}
      <div className="space-y-1">
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
            title="All Beer & Liquor"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-page-title text-foreground flex-1 min-w-0 truncate">
            {item.name}
          </h1>
        </div>

        {/* Badges + meta row */}
        <div className="flex flex-wrap items-center gap-2 pl-[52px]">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5',
              'text-[11px] font-bold uppercase tracking-wide',
              item.category === 'Beer'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300'
            )}
          >
            {item.category}
          </span>
          <BeerLiquorSubcategoryBadge subcategory={item.subcategory as BeerLiquorSubcategory} />
        </div>

        {/* Producer + country */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-sm text-muted-foreground">
          <span>{item.producer}</span>
          <span className="text-border">&middot;</span>
          <span>{item.country}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {BEER_LIQUOR_AI_ACTIONS.map(({ key, label, icon }) => {
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

      {/* Info sections */}
      <div className="space-y-4">
        {/* Style */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Style
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {item.style}
          </p>
        </section>

        {/* Description */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {item.description}
          </p>
        </section>

        {/* Service Notes */}
        {item.notes && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Service Notes
            </h2>
            <p className="text-sm leading-relaxed text-foreground">
              {item.notes}
            </p>
          </section>
        )}
      </div>

      {/* AI Response Sheet */}
      <BeerLiquorAISheet
        item={item}
        action={activeAction}
        open={activeAction !== null}
        onOpenChange={(open) => { if (!open) setActiveAction(null); }}
      />
    </div>
  );
}
