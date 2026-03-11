import { useState, useCallback } from 'react';
import { Expand, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DishCategoryBadge } from './DishCategoryBadge';
import { DishAllergenBadge } from './DishAllergenBadge';
import { TopSellerBadge } from '@/components/shared/TopSellerBadge';
import { useSwipeNavigation } from '@/hooks/use-swipe-navigation';
import type { Dish } from '@/types/products';
import { PRODUCT_AI_ACTIONS } from '@/data/ai-action-config';
import { AI_ACTION_ICONS } from '@/data/ai-action-icons';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CrossNavButton } from '@/components/shared/CrossNavButton';
import type { Language } from '@/hooks/use-language';
import { getCommon } from '@/lib/common-strings';

const STRINGS = {
  en: {
    keyIngredients: 'Key Ingredients',
    flavorProfile: 'Flavor Profile',
    allergyNotes: 'Allergy Notes',
    upsellNotes: 'Upsell Notes',
    detailedDescription: 'Detailed Description',
    viewBohPlateSpec: 'View BOH Plate Spec',
  },
  es: {
    keyIngredients: 'Ingredientes Clave',
    flavorProfile: 'Perfil de Sabor',
    allergyNotes: 'Notas de Alergia',
    upsellNotes: 'Notas de Venta Sugestiva',
    detailedDescription: 'Descripci\u00f3n Detallada',
    viewBohPlateSpec: 'Ver Especificaci\u00f3n BOH',
  },
} as const;

interface DishCardViewProps {
  dish: Dish;
  onBack: () => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  activeAction: string | null;
  onActionChange: (action: string | null) => void;
  bohSlug?: string | null;
  language: Language;
}

type InfoCardDef = { key: string; labelKey: keyof typeof STRINGS['en']; emoji: string; bg: string; field: keyof Dish };

const INFO_CARDS: InfoCardDef[] = [
  { key: 'ingredients', labelKey: 'keyIngredients', emoji: '\uD83E\uDD69', bg: 'bg-red-100 dark:bg-red-900/30', field: 'keyIngredients' },
  { key: 'flavor', labelKey: 'flavorProfile', emoji: '\uD83C\uDFA8', bg: 'bg-violet-100 dark:bg-violet-900/30', field: 'flavorProfile' },
  { key: 'allergy', labelKey: 'allergyNotes', emoji: '\u26A0\uFE0F', bg: 'bg-amber-100 dark:bg-amber-900/30', field: 'allergyNotes' },
  { key: 'upsell', labelKey: 'upsellNotes', emoji: '\uD83D\uDCB0', bg: 'bg-green-100 dark:bg-green-900/30', field: 'upsellNotes' },
];

const PLATE_PLACEHOLDER: Record<string, { bg: string; emoji: string }> = {
  entree:    { bg: 'bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/40 dark:to-orange-800/40', emoji: '🥩' },
  appetizer: { bg: 'bg-gradient-to-br from-green-100 to-emerald-200 dark:from-green-900/40 dark:to-emerald-800/40', emoji: '🥗' },
  side:      { bg: 'bg-gradient-to-br from-sky-100 to-blue-200 dark:from-sky-900/40 dark:to-blue-800/40', emoji: '🍽️' },
  dessert:   { bg: 'bg-gradient-to-br from-pink-100 to-rose-200 dark:from-pink-900/40 dark:to-rose-800/40', emoji: '🍰' },
};

export function DishCardView({ dish, onBack, onSwipePrev, onSwipeNext, activeAction, onActionChange, bohSlug, language }: DishCardViewProps) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgErrored, setImgErrored] = useState(false);
  const handleImgError = useCallback(() => setImgErrored(true), []);
  const t = STRINGS[language];
  const c = getCommon(language);

  const hasImage = !!dish.image && !imgErrored;
  const ph = PLATE_PLACEHOLDER[dish.plateType] ?? { bg: 'bg-muted', emoji: '🍴' };

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
          {/* Name + category badge */}
          <div className="flex items-start gap-3">
            <h1 className="text-page-title text-foreground flex-1 min-w-0">
              {dish.menuName}
            </h1>
            <DishCategoryBadge category={dish.plateType} className="shrink-0 mt-1" />
            {isAdmin && dish.plateSpecId && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={(e) => { e.stopPropagation(); navigate(`/admin/ingest/edit/plate_specs/${dish.plateSpecId}`); }}
                title="Edit product"
              >
                <span className="text-[14px] leading-none">{'\u270F\uFE0F'}</span>
              </Button>
            )}
          </div>

          {/* Top seller / Featured badges */}
          {(dish.isTopSeller || dish.isFeatured) && (
            <div className="flex items-center gap-3">
              {dish.isTopSeller && <TopSellerBadge size="md" />}
              {dish.isFeatured && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="text-[16px] h-[16px] leading-[16px]">{'\u2728'}</span>
                  <span>{c.featured}</span>
                </div>
              )}
            </div>
          )}

          {/* Allergen pills + Cross-nav inline */}
          {(dish.allergens.length > 0 || bohSlug) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {dish.allergens.map(allergen => (
                <DishAllergenBadge key={allergen} allergen={allergen} />
              ))}
              {bohSlug && (
                <>
                  <div className="flex-1" />
                  <CrossNavButton
                    label={t.viewBohPlateSpec}
                    targetPath="/recipes"
                    targetSlug={bohSlug}
                  />
                </>
              )}
            </div>
          )}

          {/* Short description */}
          <p className="text-sm leading-relaxed text-foreground">
            {dish.shortDescription}
          </p>
        </div>

        {/* Image */}
        <button
          type="button"
          onClick={() => hasImage ? setLightboxOpen(true) : undefined}
          className={cn(
            "relative group sm:w-[40%] shrink-0 rounded-[20px] overflow-hidden bg-muted shadow-[3px_8px_14px_-3px_rgba(0,0,0,0.4),2px_5px_8px_-2px_rgba(0,0,0,0.25)] min-h-[180px]",
            hasImage ? "cursor-pointer" : "cursor-default"
          )}
        >
          {hasImage ? (
            <img
              src={dish.image!}
              alt={dish.menuName}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={handleImgError}
            />
          ) : (
            <div className={cn('w-full h-full min-h-[180px] flex items-center justify-center', ph.bg)}>
              <span className="text-6xl select-none">{ph.emoji}</span>
            </div>
          )}
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
      <div className="flex items-center justify-center gap-2 overflow-x-auto ai-action-scroll">
        {PRODUCT_AI_ACTIONS.dishes.map(({ key, label, icon }) => {
          const Icon = AI_ACTION_ICONS[icon];
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
              {Icon && (
                <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-white' : 'text-orange-500')} />
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
                {t[card.labelKey]}
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
          <span className="text-[14px] h-[14px] leading-[14px] inline-block mr-1">{'\uD83D\uDCCB'}</span>
          {t.detailedDescription}
        </h2>
        <p className="text-sm leading-relaxed text-foreground">
          {dish.detailedDescription}
        </p>
      </section>

      {/* Notes */}
      {dish.notes && (
        <section>
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1">
            <span className="text-[14px] h-[14px] leading-[14px] inline-block mr-1">{'\uD83D\uDCDD'}</span>
            {c.notes}
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
          {hasImage ? (
            <img
              src={dish.image!}
              alt={dish.menuName}
              className="min-w-[70vw] max-w-[85vw] max-h-[85vh] rounded-xl object-contain"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <div className={cn('w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-xl flex items-center justify-center', ph.bg)} onClick={e => e.stopPropagation()}>
              <span className="text-[100px] select-none">{ph.emoji}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
