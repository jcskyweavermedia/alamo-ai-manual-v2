// =============================================================================
// SectionHeaderElementRenderer — WYSIWYG inline editing for section_header.
// Matches PlayerSectionHeaderRenderer CSS exactly.
// =============================================================================

import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText, InlineEditableSplitTitle } from '@/components/course-builder/InlineEditableText';
import type { SectionHeaderElement } from '@/types/course-builder';

interface Props {
  element: SectionHeaderElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function SectionHeaderElementRenderer({ element, language }: Props) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const titleKey = language === 'es' ? 'title_es' : 'title_en';
  const subtitleKey = language === 'es' ? 'subtitle_es' : 'subtitle_en';
  const titleValue = (language === 'es' ? (element.title_es || element.title_en) : element.title_en) || '';
  const subtitleValue = (language === 'es' ? (element.subtitle_es || element.subtitle_en) : element.subtitle_en) || '';

  return (
    <div className="space-y-1">
      {/* Number label */}
      <InlineEditableText
        value={element.number_label || ''}
        onChange={(v) => updateElementSilent(element.key, { number_label: v })}
        onCommit={() => updateElement(element.key, { number_label: element.number_label })}
        onFocus={() => selectElement(element.key)}
        placeholder="01 — Section Name"
        className="text-[0.7rem] font-bold text-orange-500 uppercase tracking-[0.06em]"
        minHeight="min-h-[20px]"
      />

      {/* Title (light|bold split) */}
      <InlineEditableSplitTitle
        value={titleValue}
        onChange={(v) => updateElementSilent(element.key, { [titleKey]: v })}
        onCommit={(v) => updateElement(element.key, { [titleKey]: v })}
        onFocus={() => selectElement(element.key)}
        placeholder="Section Title"
        wrapperClassName="text-[clamp(1.5rem,4vw,1.75rem)] leading-[1.15] tracking-[-0.02em] text-foreground"
        lightClassName="block font-light"
        boldClassName="font-black"
      />

      {/* Subtitle */}
      <InlineEditableText
        value={subtitleValue}
        onChange={(v) => updateElementSilent(element.key, { [subtitleKey]: v })}
        onCommit={(v) => updateElement(element.key, { [subtitleKey]: v })}
        onFocus={() => selectElement(element.key)}
        placeholder="Subtitle..."
        className="text-sm text-muted-foreground leading-[1.5]"
        minHeight="min-h-[20px]"
      />
    </div>
  );
}
