import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { BeerLiquorSubcategoryBadge } from './BeerLiquorSubcategoryBadge';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { BeerLiquorItem } from '@/types/products';
import type { BeerLiquorSubcategory } from '@/data/mock-beer-liquor';
import { PRODUCT_AI_ACTIONS } from '@/data/ai-action-config';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';

const AI_EMOJI_MAP: Record<string, string> = {
  'graduation-cap': '🎓',
  'utensils-crossed': '🍴',
  'help-circle': '❓',
};

interface BeerLiquorCardViewProps {
  item: BeerLiquorItem;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
}

export function BeerLiquorCardView({ item, onBack, onPrev, onNext, activeAction, onActionChange }: BeerLiquorCardViewProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
    enabled: activeAction === null,
  });

  return (
    <div ref={swipeRef} className="md:h-[calc(100vh-theme(spacing.14)-theme(spacing.8))] md:flex md:flex-col">
      {/* Header */}
      <div className="space-y-1 mb-3 md:mb-2 shrink-0">
        {/* Back button + title row */}
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'flex items-center justify-center shrink-0',
              'h-10 w-10 rounded-lg',
              'bg-orange-500 text-white',
              'hover:bg-orange-600 active:bg-orange-700',
              'shadow-sm transition-colors duration-150',
              'mt-0.5'
            )}
            title="All Beer & Liquor"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
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
            <h1 className="text-page-title text-foreground truncate">
              {item.name}
            </h1>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/ingest/edit/beer_liquor_list/${item.id}`); }}
              title="Edit product"
            >
              <span className="text-[14px] leading-none">✏️</span>
            </Button>
          )}
        </div>

        {/* Producer + country */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-[52px] text-sm text-muted-foreground">
          <span>{item.producer}</span>
          <span className="text-border">·</span>
          <span>{item.country}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border mb-4 md:mb-3 shrink-0" />

      {/* AI Action Buttons — emoji tile style (matches wine card) */}
      <div className="flex items-center justify-center gap-2 mb-5 md:mb-4 flex-wrap">
        {PRODUCT_AI_ACTIONS.beer_liquor.map(({ key, label, icon }) => {
          const emoji = AI_EMOJI_MAP[icon];
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
              {emoji && (
                <span className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-8 h-8 rounded-[10px]',
                  isActive ? 'bg-white/30' : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <span className="text-[18px] h-[18px] leading-[18px]">{emoji}</span>
                </span>
              )}
              <span>{label}</span>
              <ChevronRight className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-white/60' : 'text-muted-foreground')} />
            </button>
          );
        })}
      </div>

      {/* Info cards */}
      <div className="flex-1 min-w-0 space-y-3 md:overflow-y-auto">
        {/* Style */}
        <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
          <span className={cn(
            'absolute top-3 right-3',
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-amber-100 dark:bg-amber-900/30'
          )}>
            <span className="text-[22px] h-[22px] leading-[22px]">{item.category === 'Beer' ? '🍺' : '🥃'}</span>
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Style
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {item.style}
          </p>
        </div>

        {/* Description */}
        <div className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
          <span className={cn(
            'absolute top-3 right-3',
            'flex items-center justify-center',
            'w-10 h-10 rounded-full',
            'bg-blue-100 dark:bg-blue-900/30'
          )}>
            <span className="text-[22px] h-[22px] leading-[22px]">📋</span>
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {item.description}
          </p>
        </div>

        {/* Service Notes */}
        {item.notes && (
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
              Service Notes
            </h2>
            <p className="text-sm leading-relaxed text-foreground">
              {item.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
