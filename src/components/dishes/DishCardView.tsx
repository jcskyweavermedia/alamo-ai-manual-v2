import { useState } from 'react';
import { ArrowLeft, Expand, X, Mic, Play, GraduationCap, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DishCategoryBadge } from './DishCategoryBadge';
import { DishAllergenBadge } from './DishAllergenBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { DishAISheet } from './DishAISheet';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Dish } from '@/types/products';
import type { DishAIAction } from '@/data/mock-dishes';
import { DISH_AI_ACTIONS } from '@/data/mock-dishes';

interface DishCardViewProps {
  dish: Dish;
  onBack: () => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
}

const AI_ICON_MAP: Record<string, typeof Mic> = {
  mic: Mic,
  play: Play,
  'graduation-cap': GraduationCap,
  'help-circle': HelpCircle,
};

export function DishCardView({ dish, onBack, onSwipePrev, onSwipeNext }: DishCardViewProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<DishAIAction | null>(null);

  const { ref: swipeRef } = useSwipeNavigation({
    onSwipeLeft: onSwipeNext,
    onSwipeRight: onSwipePrev,
    enabled: !lightboxOpen && activeAction === null,
  });

  return (
    <div ref={swipeRef} className="space-y-md">
      {/* Two-column header: Info left, Image right (stacks on mobile: info → image) */}
      <div className="flex flex-col sm:flex-row gap-md">
        {/* Info column — back button + name, badges, allergens, short description */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Back + Name + category badge */}
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
              title="All Dishes"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-page-title text-foreground flex-1 min-w-0">
              {dish.menuName}
            </h1>
            <DishCategoryBadge category={dish.plateType} className="shrink-0 mt-1" />
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

          {/* Short description */}
          <p className="text-sm leading-relaxed text-foreground">
            {dish.shortDescription}
          </p>
        </div>

        {/* Image — 40% width on desktop, full on mobile */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative group sm:w-[40%] shrink-0 rounded-lg overflow-hidden cursor-pointer bg-muted"
        >
          <div className="aspect-[16/10]">
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

      {/* AI Action Buttons */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {DISH_AI_ACTIONS.map(({ key, label, icon }) => {
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

      {/* 2x2 Info Grid — equal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Ingredients
          </h2>
          <p className="text-sm font-medium text-foreground">
            {dish.keyIngredients.join(' \u00B7 ')}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">
            {dish.ingredients.join(' \u00B7 ')}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Flavor Profile
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {dish.flavorProfile.join(' \u00B7 ')}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Allergy Notes
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {dish.allergyNotes}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Upsell Notes
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {dish.upsellNotes}
          </p>
        </div>
      </div>

      {/* Detailed Description — full width */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
          Detailed Description
        </h2>
        <p className="text-sm leading-relaxed text-foreground">
          {dish.detailedDescription}
        </p>
      </section>

      {/* Notes — full width */}
      {dish.notes && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            Notes
          </h2>
          <p className="text-sm leading-relaxed text-foreground">
            {dish.notes}
          </p>
        </section>
      )}

      {/* AI Response Sheet */}
      <DishAISheet
        dish={dish}
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
            src={dish.image}
            alt={dish.menuName}
            className="max-w-[90%] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
