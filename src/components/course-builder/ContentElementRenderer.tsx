// =============================================================================
// ContentElementRenderer — WYSIWYG inline editing for content elements.
// Matches PlayerContentRenderer CSS exactly.
// =============================================================================

import { FileText } from 'lucide-react';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText } from '@/components/course-builder/InlineEditableText';
import { ElementConfigBar } from '@/components/course-builder/ElementConfigBar';
import type { ContentElement } from '@/types/course-builder';

interface ContentElementRendererProps {
  element: ContentElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function ContentElementRenderer({ element, language, isSelected }: ContentElementRendererProps) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const titleKey = language === 'es' ? 'title_es' : 'title_en';
  const bodyKey = language === 'es' ? 'body_es' : 'body_en';
  const titleValue = (language === 'es' ? (element.title_es || element.title_en) : element.title_en) || '';
  const bodyValue = (language === 'es' ? (element.body_es || element.body_en) : element.body_en) || '';

  // Lead paragraph: larger, lighter intro text
  if (element.lead) {
    return (
      <div className="relative group/config">
        <ElementConfigBar isSelected={isSelected}>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={true}
              onChange={() => updateElement(element.key, { lead: false })}
              className="rounded border-border h-3 w-3"
            />
            Intro
          </label>
        </ElementConfigBar>

        <InlineEditableText
          value={bodyValue}
          onChange={(v) => updateElementSilent(element.key, { [bodyKey]: v })}
          onCommit={(v) => updateElement(element.key, { [bodyKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Párrafo introductorio...' : 'Intro paragraph...'}
          className="text-[1.05rem] font-light text-muted-foreground leading-[1.65] max-w-[58ch] mt-2"
          markdown
          multiline
        />
      </div>
    );
  }

  return (
    <div className="space-y-1 relative group/config">
      <ElementConfigBar isSelected={isSelected}>
        <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={false}
            onChange={() => updateElement(element.key, { lead: true })}
            className="rounded border-border h-3 w-3"
          />
          Intro
        </label>
      </ElementConfigBar>

      {/* Title with FileText icon */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        <InlineEditableText
          value={titleValue}
          onChange={(v) => updateElementSilent(element.key, { [titleKey]: v })}
          onCommit={(v) => updateElement(element.key, { [titleKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Título del contenido...' : 'Content title...'}
          className="text-lg font-bold text-foreground"
          minHeight="min-h-[28px]"
        />
      </div>

      {/* Body (markdown click-to-edit) */}
      <InlineEditableText
        value={bodyValue}
        onChange={(v) => updateElementSilent(element.key, { [bodyKey]: v })}
        onCommit={(v) => updateElement(element.key, { [bodyKey]: v })}
        onFocus={() => selectElement(element.key)}
        placeholder={language === 'es' ? 'Contenido...' : 'Content...'}
        className="break-words text-sm"
        markdown
        multiline
        minHeight="min-h-[40px]"
      />
    </div>
  );
}
