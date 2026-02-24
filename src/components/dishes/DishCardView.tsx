import { useState } from 'react';
import { ArrowLeft, Expand, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DishCategoryBadge } from './DishCategoryBadge';
import { DishAllergenBadge } from './DishAllergenBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Dish } from '@/types/products';
import { PRODUCT_AI_ACTIONS } from '@/data/ai-action-config';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CrossNavButton } from '@/components/shared/CrossNavButton';

interface DishCardViewProps {
  dish: Dish;
  onBack: () => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  bohSlug?: string | null;
}

const AI_EMOJI_MAP: Record<string, { emoji: string; bg: string }> = {
  mic: { emoji: '\uD83C\uDF99\uFE0F', bg: 'bg-red-100 dark:bg-red-900/30' },
  play: { emoji: '\u25B6\uFE0F', bg: 'bg-sky-100 dark:bg-sky-900/30' },
  'graduation-cap': { emoji: '\uD83C\uDF93', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  'help-circle': { emoji: '\u2753', bg: 'bg-violet-100 dark:bg-violet-900/30' },
};

const INFO_CARDS: { key: string; label: string; emoji: string; bg: string; field: keyof Dish }[] = [
  { key: 'ingredients', label: 'Ingredients', emoji: '\uD83E\uDD69', bg: 'bg-red-100 dark:bg-red-900/30', field: 'keyIngredients' },
  { key: 'flavor', label: 'Flavor Profile', emoji: '\uD83C\uDFA8', bg: 'bg-violet-100 dark:bg-violet-900/30', field: 'flavorProfile' },
  { key: 'allergy', label: 'Allergy Notes', emoji: '\u26A0\uFE0F', bg: 'bg-amber-100 dark:bg-amber-900/30', field: 'allergyNotes' },
  { key: 'upsell', label: 'Upsell Notes', emoji: '\uD83D\uDCB0', bg: 'bg-green-100 dark:bg-green-900/30', field: 'upsellNotes' },
];

export function DishCardView({ dish, onBack, onSwipePrev, onSwipeNext, activeAction, onActionChange, bohSlug }: DishCardViewProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onSwipeNext,
    onSwipeRight: onSwipePrev,
    enabled: !lightboxOpen && activeAction === null,
  });

  return (
    <div ref={swipeRef} className="space-y-md">
      {/* Two-column header: Info left, Image right */}
      <div className="flex flex-col sm:flex-row gap-md">
        {/* Info column */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Back + Name + category badge */}
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
              title="All Dishes"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-page-title text-foreground flex-1 min-w-0">
              {dish.menuName}
            </h1>
            <DishCategoryBadge category={dish.plateType} className="shrink-0 mt-1" />
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/ingest/edit/foh_plate_specs/${dish.id}`); }}
                title="Edit product"
              >
                <span className="text-[14px] leading-none">✏️</span>
              </Button>
            )}
          </div>

          {/* Top seller badge */}
          {dish.isTopSeller && (
            <div>
              <TopSellerBadge size="md" />
            </div>
          )}

          {/* Allergen pills */}
          {dish.allergens.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dish.allergens.map(allergen => (
                <DishAllergenBadge key={allergen} allergen={allergen} />
              ))}
            </div>
          )}

          {/* Cross-nav: FOH → BOH */}
          {bohSlug && (
            <CrossNavButton
              label="View BOH Plate Spec"
              targetPath="/recipes"
              targetSlug={bohSlug}
            />
          )}

          {/* Short description */}
          <p className="text-sm leading-relaxed text-foreground">
            {dish.shortDescription}
          </p>
        </div>

        {/* Image */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative group sm:w-[40%] shrink-0 rounded-[20px] overflow-hidden cursor-pointer bg-muted shadow-[3px_8px_14px_-3px_rgba(0,0,0,0.4),2px_5px_8px_-2px_rgba(0,0,0,0.25)]"
        >
          <div className="aspect-[16/10] max-h-44 md:max-h-52">
            <img
              src={dish.image}
              alt={dish.menuName}
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

      {/* AI Action Buttons — white, no border, colored emoji tile + chevron */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto ai-action-scroll">
        {PRODUCT_AI_ACTIONS.dishes.map(({ key, label, icon }) => {
          const config = AI_EMOJI_MAP[icon];
          const isActive = activeAction === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onActionChange(isActive ? null : key)}
              className={cn(
                'flex items-center gap-2 shrink-0',
                'h-10 px-3 rounded-xl',
                'text-[12px] font-medium',
                'transition-all duration-150',
                'active:scale-[0.97]',
                isActive
                  ? 'bg-orange-400 text-white shadow-sm'
                  : 'bg-card text-foreground shadow-sm hover:shadow-md'
              )}
            >
              {config && (
                <span className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-8 h-8 rounded-[10px]',
                  isActive ? 'bg-white/30' : 'bg-slate-100 dark:bg-slate-800'
                )}>
                  <span className="text-[18px] h-[18px] leading-[18px]">{config.emoji}</span>
                </span>
              )}
              <span>{label}</span>
              <ChevronRight className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'text-white/60' : 'text-muted-foreground')} />
            </button>
          );
        })}
      </div>

      {/* 2x2 Info Grid — white cards, emoji in colored tile top-right */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INFO_CARDS.map(card => {
          const value = dish[card.field];
          const text = Array.isArray(value) ? (value as string[]).join(' \u00B7 ') : (value as string);
          return (
            <div key={card.key} className="relative rounded-xl bg-card shadow-sm p-4 pt-5 pr-16">
              {/* Emoji tile — top right */}
              <span className={cn(
                'absolute top-3 right-3',
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                card.bg
              )}>
                <span className="text-[22px] h-[22px] leading-[22px]">{card.emoji}</span>
              </span>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                {card.label}
              </h2>
              {card.key === 'ingredients' ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {(dish.keyIngredients as string[]).join(' \u00B7 ')}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">
                    {(dish.ingredients as string[]).join(' \u00B7 ')}
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-foreground">
                  {text}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Detailed Description */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
          <span className="text-[14px] h-[14px] leading-[14px] inline-block mr-1">📋</span>
          Detailed Description
        </h2>
        <p className="text-sm leading-relaxed text-foreground">
          {dish.detailedDescription}
        </p>
      </section>

      {/* Notes */}
      {dish.notes && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            <span className="text-[14px] h-[14px] leading-[14px] inline-block mr-1">📝</span>
            Notes
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {dish.notes}
          </p>
        </section>
      )}

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
            src={dish.image}
            alt={dish.menuName}
            className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
