// =============================================================================
// ComparisonElementRenderer — WYSIWYG inline editing for comparison elements.
// Matches PlayerComparisonRenderer CSS exactly.
// =============================================================================

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText } from '@/components/course-builder/InlineEditableText';
import { ElementConfigBar } from '@/components/course-builder/ElementConfigBar';
import { COMPARISON_VARIANTS } from '@/lib/course-builder/builder-utils';
import type { ComparisonElement, ComparisonVariant, ComparisonSide } from '@/types/course-builder';

interface Props {
  element: ComparisonElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function ComparisonElementRenderer({ element, language, isSelected }: Props) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const variantSelector = (
    <ElementConfigBar isSelected={isSelected}>
      <select
        value={element.variant}
        onChange={(e) => updateElement(element.key, { variant: e.target.value as ComparisonVariant })}
        className="text-[10px] bg-transparent border-0 outline-none cursor-pointer font-semibold"
      >
        {(Object.entries(COMPARISON_VARIANTS) as [ComparisonVariant, { labelEn: string; labelEs: string }][]).map(([v, c]) => (
          <option key={v} value={v}>{language === 'es' ? c.labelEs : c.labelEn}</option>
        ))}
      </select>
    </ElementConfigBar>
  );

  if (element.variant === 'miss_fix') {
    return (
      <div className="relative group/config mt-5">
        {variantSelector}
        <MissFixInline element={element} language={language} updateElement={updateElement} updateElementSilent={updateElementSilent} selectElement={selectElement} />
      </div>
    );
  }

  return (
    <div className="relative group/config mt-5">
      {variantSelector}
      <CorrectIncorrectInline element={element} language={language} updateElement={updateElement} updateElementSilent={updateElementSilent} selectElement={selectElement} />
    </div>
  );
}

// --- Correct / Incorrect inline ---
function CorrectIncorrectInline({
  element,
  language,
  updateElement,
  updateElementSilent,
  selectElement,
}: {
  element: ComparisonElement;
  language: 'en' | 'es';
  updateElement: (key: string, updates: Partial<ComparisonElement>) => void;
  updateElementSilent: (key: string, updates: Partial<ComparisonElement>) => void;
  selectElement: (key: string | null) => void;
}) {
  const itemsKey = language === 'es' ? 'items_es' : 'items_en';
  const tagKey = language === 'es' ? 'tag_es' : 'tag_en';
  const titleKey = language === 'es' ? 'title_es' : 'title_en';

  const defaultSide: ComparisonSide = { tag_en: '', tag_es: '', title_en: '', title_es: '', items_en: [], items_es: [] };
  const positive = element.positive || defaultSide;
  const negative = element.negative || defaultSide;

  const getSide = (side: 'positive' | 'negative') => side === 'positive' ? positive : negative;

  const updateSide = (side: 'positive' | 'negative', updates: Partial<ComparisonSide>, silent = false) => {
    const fn = silent ? updateElementSilent : updateElement;
    fn(element.key, { [side]: { ...getSide(side), ...updates } });
  };

  const updateItem = (side: 'positive' | 'negative', index: number, value: string, silent = false) => {
    const items = [...(getSide(side)[itemsKey] || [])];
    items[index] = value;
    updateSide(side, { [itemsKey]: items }, silent);
  };

  const removeItem = (side: 'positive' | 'negative', index: number) => {
    const items = [...(getSide(side)[itemsKey] || [])];
    items.splice(index, 1);
    updateSide(side, { [itemsKey]: items });
  };

  const addItem = (side: 'positive' | 'negative') => {
    updateSide(side, { [itemsKey]: [...(getSide(side)[itemsKey] || []), ''] });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Positive (dark) */}
      <div className="bg-foreground text-white rounded-[20px] p-6">
        <InlineEditableText
          value={positive[tagKey] || ''}
          onChange={(v) => updateSide('positive', { [tagKey]: v }, true)}
          onCommit={(v) => updateSide('positive', { [tagKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Tag..."
          className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] bg-orange-500/20 text-orange-400 px-2.5 py-1 rounded-full mb-2.5"
          darkBg
          minHeight="min-h-[16px]"
        />
        <InlineEditableText
          value={positive[titleKey] || ''}
          onChange={(v) => updateSide('positive', { [titleKey]: v }, true)}
          onCommit={(v) => updateSide('positive', { [titleKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Title..."
          className="text-base font-extrabold mb-2.5 leading-[1.2]"
          darkBg
          minHeight="min-h-[24px]"
        />
        <ul className="text-[13px] leading-[1.9] space-y-0.5">
          {(positive[itemsKey] || []).map((item, i) => (
            <li key={i} className="group/item flex gap-1.5 items-start">
              <span className="text-orange-400 font-bold shrink-0">+</span>
              <InlineEditableText
                value={item}
                onChange={(v) => updateItem('positive', i, v, true)}
                onCommit={(v) => updateItem('positive', i, v)}
                onFocus={() => selectElement(element.key)}
                placeholder="Item..."
                className="text-[13px] flex-1"
                darkBg
                minHeight="min-h-[20px]"
              />
              <button
                type="button"
                className="opacity-0 group-hover/item:opacity-100 text-white/40 hover:text-white/80 shrink-0"
                onClick={(e) => { e.stopPropagation(); removeItem('positive', i); }}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-[10px] text-orange-400 hover:text-orange-300 mt-2 flex items-center gap-0.5"
          onClick={(e) => { e.stopPropagation(); addItem('positive'); }}
        >
          <Plus className="h-3 w-3" /> Item
        </button>
      </div>

      {/* Negative (light) */}
      <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm p-6">
        <InlineEditableText
          value={negative[tagKey] || ''}
          onChange={(v) => updateSide('negative', { [tagKey]: v }, true)}
          onCommit={(v) => updateSide('negative', { [tagKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Tag..."
          className="inline-block text-[10px] font-bold uppercase tracking-[0.08em] bg-black/5 text-muted-foreground px-2.5 py-1 rounded-full mb-2.5"
          minHeight="min-h-[16px]"
        />
        <InlineEditableText
          value={negative[titleKey] || ''}
          onChange={(v) => updateSide('negative', { [titleKey]: v }, true)}
          onCommit={(v) => updateSide('negative', { [titleKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Title..."
          className="text-base font-extrabold mb-2.5 leading-[1.2] text-foreground"
          minHeight="min-h-[24px]"
        />
        <ul className="text-[13px] text-muted-foreground leading-[1.9] space-y-0.5">
          {(negative[itemsKey] || []).map((item, i) => (
            <li key={i} className="group/item flex gap-1.5 items-start">
              <span className="text-muted-foreground/40 font-bold shrink-0">&minus;</span>
              <InlineEditableText
                value={item}
                onChange={(v) => updateItem('negative', i, v, true)}
                onCommit={(v) => updateItem('negative', i, v)}
                onFocus={() => selectElement(element.key)}
                placeholder="Item..."
                className="text-[13px] text-muted-foreground flex-1"
                minHeight="min-h-[20px]"
              />
              <button
                type="button"
                className="opacity-0 group-hover/item:opacity-100 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
                onClick={(e) => { e.stopPropagation(); removeItem('negative', i); }}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="text-[10px] text-muted-foreground hover:text-foreground mt-2 flex items-center gap-0.5"
          onClick={(e) => { e.stopPropagation(); addItem('negative'); }}
        >
          <Plus className="h-3 w-3" /> Item
        </button>
      </div>
    </div>
  );
}

// --- Miss / Fix inline ---
function MissFixInline({
  element,
  language,
  updateElement,
  updateElementSilent,
  selectElement,
}: {
  element: ComparisonElement;
  language: 'en' | 'es';
  updateElement: (key: string, updates: Partial<ComparisonElement>) => void;
  updateElementSilent: (key: string, updates: Partial<ComparisonElement>) => void;
  selectElement: (key: string | null) => void;
}) {
  const itemsKey = language === 'es' ? 'items_es' : 'items_en';
  const missLabel = language === 'es' ? 'Error' : 'Miss';
  const fixLabel = language === 'es' ? 'Solución' : 'Fix';

  const pairs = element.pairs || [];

  const updatePairItem = (pairIndex: number, itemIndex: number, value: string, silent = false) => {
    const updated = [...pairs];
    const items = [...(updated[pairIndex][itemsKey] || ['', ''])];
    items[itemIndex] = value;
    updated[pairIndex] = { ...updated[pairIndex], [itemsKey]: items };
    if (silent) {
      updateElementSilent(element.key, { pairs: updated });
    } else {
      updateElement(element.key, { pairs: updated });
    }
  };

  const removePair = (index: number) => {
    const updated = [...pairs];
    updated.splice(index, 1);
    updateElement(element.key, { pairs: updated });
  };

  const addPair = () => {
    const newPair: ComparisonSide = { tag_en: 'Miss', tag_es: 'Error', items_en: ['', ''], items_es: ['', ''] };
    updateElement(element.key, { pairs: [...pairs, newPair] });
  };

  return (
    <div className="flex flex-col gap-2">
      {pairs.map((pair, i) => (
        <div key={i} className="group/pair bg-card rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden relative">
          {/* Delete pair button */}
          <button
            type="button"
            className="absolute top-2 right-2 opacity-0 group-hover/pair:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
            onClick={(e) => { e.stopPropagation(); removePair(i); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Miss row */}
          <div className="flex items-start gap-3 px-5 py-3.5">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] bg-red-50 text-red-600 px-2.5 py-0.5 rounded-full shrink-0 mt-0.5">
              {missLabel}
            </span>
            <InlineEditableText
              value={pair[itemsKey]?.[0] || ''}
              onChange={(v) => updatePairItem(i, 0, v, true)}
              onCommit={(v) => updatePairItem(i, 0, v)}
              onFocus={() => selectElement(element.key)}
              placeholder="Miss text..."
              className="text-[13px] text-muted-foreground leading-[1.55] flex-1"
              multiline
              minHeight="min-h-[20px]"
            />
          </div>

          {/* Fix row */}
          <div className="flex items-start gap-3 px-5 py-3.5 border-t border-black/[0.04]">
            <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] bg-green-50 text-green-600 px-2.5 py-0.5 rounded-full shrink-0 mt-0.5">
              {fixLabel}
            </span>
            <InlineEditableText
              value={pair[itemsKey]?.[1] || ''}
              onChange={(v) => updatePairItem(i, 1, v, true)}
              onCommit={(v) => updatePairItem(i, 1, v)}
              onFocus={() => selectElement(element.key)}
              placeholder="Fix text..."
              className="text-[13px] text-muted-foreground leading-[1.55] flex-1"
              multiline
              minHeight="min-h-[20px]"
            />
          </div>
        </div>
      ))}

      {/* Add pair button */}
      <button
        type="button"
        className="bg-card rounded-[20px] border-2 border-dashed border-border/50 px-5 py-4 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        onClick={(e) => { e.stopPropagation(); addPair(); }}
      >
        <Plus className="h-3.5 w-3.5" />
        {language === 'es' ? 'Agregar par' : 'Add pair'}
      </button>
    </div>
  );
}
