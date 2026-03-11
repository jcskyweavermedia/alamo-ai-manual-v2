// =============================================================================
// PageHeaderElementRenderer — WYSIWYG inline editing for page_header.
// Matches PlayerPageHeaderRenderer CSS exactly.
// =============================================================================

import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText, InlineEditableSplitTitle } from '@/components/course-builder/InlineEditableText';
import type { PageHeaderElement } from '@/types/course-builder';

interface Props {
  element: PageHeaderElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function PageHeaderElementRenderer({ element, language }: Props) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const titleKey = language === 'es' ? 'title_es' : 'title_en';
  const taglineKey = language === 'es' ? 'tagline_es' : 'tagline_en';
  const badgeKey = language === 'es' ? 'badge_es' : 'badge_en';
  const iconLabelKey = language === 'es' ? 'icon_label_es' : 'icon_label_en';

  const titleValue = (language === 'es' ? (element.title_es || element.title_en) : element.title_en) || '';
  const taglineValue = (language === 'es' ? (element.tagline_es || element.tagline_en) : element.tagline_en) || '';
  const badgeValue = (language === 'es' ? (element.badge_es || element.badge_en) : element.badge_en) || '';
  const iconLabelValue = (language === 'es' ? (element.icon_label_es || element.icon_label_en) : element.icon_label_en) || '';

  return (
    <header className="pt-14 pb-6">
      {/* Badge pill — always render for editability */}
      <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-600 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-5">
        {/* Badge icon (clickable emoji) */}
        <InlineEditableText
          value={element.badge_icon || ''}
          onChange={(v) => updateElementSilent(element.key, { badge_icon: v })}
          onCommit={(v) => updateElement(element.key, { badge_icon: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="🎯"
          className="text-xs w-6 text-center"
          minHeight="min-h-[16px]"
        />
        {/* Badge text */}
        <InlineEditableText
          value={badgeValue}
          onChange={(v) => updateElementSilent(element.key, { [badgeKey]: v })}
          onCommit={(v) => updateElement(element.key, { [badgeKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Badge text"
          className="text-xs font-semibold"
          minHeight="min-h-[16px]"
        />
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          {/* Title (light|bold split) */}
          <InlineEditableSplitTitle
            value={titleValue}
            onChange={(v) => updateElementSilent(element.key, { [titleKey]: v })}
            onCommit={(v) => updateElement(element.key, { [titleKey]: v })}
            onFocus={() => selectElement(element.key)}
            placeholder="Page Title"
            wrapperClassName="text-[clamp(1.85rem,6vw,2.5rem)] leading-[1.15] tracking-tight"
            lightClassName="block font-light"
            boldClassName="block font-black"
          />

          {/* Tagline */}
          <InlineEditableText
            value={taglineValue}
            onChange={(v) => updateElementSilent(element.key, { [taglineKey]: v })}
            onCommit={(v) => updateElement(element.key, { [taglineKey]: v })}
            onFocus={() => selectElement(element.key)}
            placeholder="Tagline..."
            className="text-[15px] text-muted-foreground mt-2 max-w-[50ch]"
            minHeight="min-h-[20px]"
          />
        </div>

        {/* Icon tile — always render for editability */}
        <div className="shrink-0 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: element.icon ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)' : undefined,
              boxShadow: element.icon ? '0 2px 8px rgb(249 115 22 / 0.12)' : undefined,
              border: !element.icon ? '2px dashed rgb(249 115 22 / 0.2)' : undefined,
            }}
          >
            <InlineEditableText
              value={element.icon || ''}
              onChange={(v) => updateElementSilent(element.key, { icon: v })}
              onCommit={(v) => updateElement(element.key, { icon: v })}
              onFocus={() => selectElement(element.key)}
              placeholder="🍄"
              className="text-[28px] text-center w-full"
              minHeight="min-h-[28px]"
            />
          </div>
          {/* Icon label */}
          <InlineEditableText
            value={iconLabelValue}
            onChange={(v) => updateElementSilent(element.key, { [iconLabelKey]: v })}
            onCommit={(v) => updateElement(element.key, { [iconLabelKey]: v })}
            onFocus={() => selectElement(element.key)}
            placeholder="LABEL"
            className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mt-2 text-center"
            minHeight="min-h-[16px]"
          />
        </div>
      </div>
    </header>
  );
}
