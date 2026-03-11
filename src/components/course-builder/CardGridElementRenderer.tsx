// =============================================================================
// CardGridElementRenderer — WYSIWYG inline editing for card_grid.
// Matches PlayerCardGridRenderer CSS exactly.
// =============================================================================

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText } from '@/components/course-builder/InlineEditableText';
import { ElementConfigBar } from '@/components/course-builder/ElementConfigBar';
import { CARD_GRID_VARIANTS, ICON_BG_GRADIENTS } from '@/lib/course-builder/builder-utils';
import type { CardGridElement, CardGridVariant } from '@/types/course-builder';

interface Props {
  element: CardGridElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function CardGridElementRenderer({ element, language, isSelected }: Props) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const cards = element.cards || [];
  const cols = element.columns === 2
    ? '@sm:grid-cols-2'
    : '@sm:grid-cols-2 @lg:grid-cols-3';
  const titleKey = language === 'es' ? 'title_es' : 'title_en';
  const bodyKey = language === 'es' ? 'body_es' : 'body_en';

  const addCard = () => {
    const newCards = [...cards, { icon: '', icon_bg: 'orange', title_en: '', title_es: '', body_en: '', body_es: '' }];
    updateElement(element.key, { cards: newCards });
  };

  const removeCard = (index: number) => {
    const updated = [...cards];
    updated.splice(index, 1);
    updateElement(element.key, { cards: updated });
  };

  const updateCard = (index: number, field: string, value: string, silent = false) => {
    const updated = [...cards];
    updated[index] = { ...updated[index], [field]: value };
    if (silent) {
      updateElementSilent(element.key, { cards: updated });
    } else {
      updateElement(element.key, { cards: updated });
    }
  };

  return (
    <div className="relative group/config mt-5">
      {/* Config bar: variant + columns */}
      <ElementConfigBar isSelected={isSelected}>
        <select
          value={element.variant}
          onChange={(e) => updateElement(element.key, { variant: e.target.value as CardGridVariant })}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer font-semibold"
        >
          {(Object.entries(CARD_GRID_VARIANTS) as [CardGridVariant, { labelEn: string; labelEs: string }][]).map(([v, c]) => (
            <option key={v} value={v}>{language === 'es' ? c.labelEs : c.labelEn}</option>
          ))}
        </select>
        <select
          value={element.columns}
          onChange={(e) => updateElement(element.key, { columns: Number(e.target.value) as 2 | 3 })}
          className="text-[10px] bg-transparent border-0 outline-none cursor-pointer"
        >
          <option value={2}>2 cols</option>
          <option value={3}>3 cols</option>
        </select>
      </ElementConfigBar>

      <div className="@container">
      <div className={cn('grid grid-cols-1 gap-3', cols)}>
        {cards.map((card, i) => {
          const gradientBg = ICON_BG_GRADIENTS[card.icon_bg || 'orange'] || ICON_BG_GRADIENTS.orange;
          const cardTitleValue = (language === 'es' ? (card.title_es || card.title_en) : card.title_en) || '';
          const cardBodyValue = (language === 'es' ? (card.body_es || card.body_en) : card.body_en) || '';

          if (element.variant === 'bilingual') {
            return (
              <div key={i} className="group/card bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5 relative">
                <button
                  type="button"
                  className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                  onClick={(e) => { e.stopPropagation(); removeCard(i); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-muted-foreground/60 mb-1.5">
                  {language === 'es' ? 'Español' : 'English'}
                </div>
                <InlineEditableText
                  value={cardBodyValue}
                  onChange={(v) => updateCard(i, bodyKey, v, true)}
                  onCommit={(v) => updateCard(i, bodyKey, v)}
                  onFocus={() => selectElement(element.key)}
                  placeholder="Text..."
                  className="text-[13px] text-muted-foreground leading-[1.5]"
                  markdown
                  multiline
                  minHeight="min-h-[20px]"
                />
              </div>
            );
          }

          if (element.variant === 'menu_item') {
            return (
              <div key={i} className="group/card bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5 relative overflow-hidden">
                {/* Orange top bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ background: 'linear-gradient(90deg, #F97316, #FDBA74)', borderRadius: '20px 20px 0 0' }}
                />
                <button
                  type="button"
                  className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                  onClick={(e) => { e.stopPropagation(); removeCard(i); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {/* Icon */}
                <InlineEditableText
                  value={card.icon || ''}
                  onChange={(v) => updateCard(i, 'icon', v, true)}
                  onCommit={(v) => updateCard(i, 'icon', v)}
                  onFocus={() => selectElement(element.key)}
                  placeholder="🍽️"
                  className="text-[2rem] mb-2.5 block"
                  minHeight="min-h-[36px]"
                />
                <InlineEditableText
                  value={cardTitleValue}
                  onChange={(v) => updateCard(i, titleKey, v, true)}
                  onCommit={(v) => updateCard(i, titleKey, v)}
                  onFocus={() => selectElement(element.key)}
                  placeholder="Title..."
                  className="text-[15px] font-bold text-foreground mb-1 leading-[1.3]"
                  minHeight="min-h-[20px]"
                />
                <InlineEditableText
                  value={cardBodyValue}
                  onChange={(v) => updateCard(i, bodyKey, v, true)}
                  onCommit={(v) => updateCard(i, bodyKey, v)}
                  onFocus={() => selectElement(element.key)}
                  placeholder="Body..."
                  className="text-[13px] text-muted-foreground leading-[1.5]"
                  markdown
                  multiline
                  minHeight="min-h-[20px]"
                />
              </div>
            );
          }

          // icon_tile (default)
          return (
            <div key={i} className="group/card bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-5 relative">
              <button
                type="button"
                className="absolute top-2 right-2 opacity-0 group-hover/card:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
                onClick={(e) => { e.stopPropagation(); removeCard(i); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {/* Icon tile */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: card.icon ? gradientBg : undefined, border: !card.icon ? '2px dashed rgba(0,0,0,0.1)' : undefined }}
              >
                <InlineEditableText
                  value={card.icon || ''}
                  onChange={(v) => updateCard(i, 'icon', v, true)}
                  onCommit={(v) => updateCard(i, 'icon', v)}
                  onFocus={() => selectElement(element.key)}
                  placeholder="💡"
                  className="text-[22px] text-center w-full"
                  minHeight="min-h-[22px]"
                />
              </div>
              <InlineEditableText
                value={cardTitleValue}
                onChange={(v) => updateCard(i, titleKey, v, true)}
                onCommit={(v) => updateCard(i, titleKey, v)}
                onFocus={() => selectElement(element.key)}
                placeholder="Title..."
                className="text-sm font-bold text-foreground mb-1 leading-[1.3]"
                minHeight="min-h-[20px]"
              />
              <InlineEditableText
                value={cardBodyValue}
                onChange={(v) => updateCard(i, bodyKey, v, true)}
                onCommit={(v) => updateCard(i, bodyKey, v)}
                onFocus={() => selectElement(element.key)}
                placeholder="Body..."
                className="text-[13px] text-muted-foreground leading-[1.5]"
                markdown
                multiline
                minHeight="min-h-[20px]"
              />
            </div>
          );
        })}

        {/* Add card placeholder */}
        <button
          type="button"
          className="bg-card rounded-[20px] border-2 border-dashed border-border/50 p-5 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-border transition-colors min-h-[100px]"
          onClick={(e) => { e.stopPropagation(); addCard(); }}
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">{language === 'es' ? 'Agregar tarjeta' : 'Add card'}</span>
        </button>
      </div>
      </div>
    </div>
  );
}
