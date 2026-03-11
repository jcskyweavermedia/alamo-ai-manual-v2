// =============================================================================
// ScriptBlockElementRenderer — WYSIWYG inline editing for script_block.
// Matches PlayerScriptBlockRenderer CSS exactly.
// =============================================================================

import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText } from '@/components/course-builder/InlineEditableText';
import type { ScriptBlockElement } from '@/types/course-builder';

interface Props {
  element: ScriptBlockElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function ScriptBlockElementRenderer({ element, language }: Props) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const lines = element.lines || [];
  const headerKey = language === 'es' ? 'header_es' : 'header_en';
  const headerValue = (language === 'es' ? (element.header_es || element.header_en) : element.header_en) || '';

  const addLine = () => {
    const updated = [...lines, { text_en: '', text_es: '' }];
    updateElement(element.key, { lines: updated });
  };

  const removeLine = (index: number) => {
    const updated = [...lines];
    updated.splice(index, 1);
    updateElement(element.key, { lines: updated });
  };

  const updateLine = (index: number, field: string, value: string, silent = false) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    if (silent) {
      updateElementSilent(element.key, { lines: updated });
    } else {
      updateElement(element.key, { lines: updated });
    }
  };

  return (
    <div className="bg-card rounded-[20px] border border-black/[0.04] shadow-sm overflow-hidden mt-5">
      {/* Header bar */}
      <div className="px-6 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-1.5">
        {/* Header icon */}
        <InlineEditableText
          value={element.header_icon || ''}
          onChange={(v) => updateElementSilent(element.key, { header_icon: v })}
          onCommit={(v) => updateElement(element.key, { header_icon: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="🎬"
          className="text-[0.7rem] w-5"
          minHeight="min-h-[14px]"
        />
        {/* Header text */}
        <InlineEditableText
          value={headerValue}
          onChange={(v) => updateElementSilent(element.key, { [headerKey]: v })}
          onCommit={(v) => updateElement(element.key, { [headerKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="Script Header"
          className="text-[0.7rem] font-bold uppercase tracking-[0.06em] text-orange-600 flex-1"
          minHeight="min-h-[14px]"
        />
      </div>

      {/* Lines */}
      {lines.map((line, i) => (
        <div
          key={i}
          className="group/line px-6 py-4 border-b border-black/[0.04] last:border-b-0 relative"
        >
          {/* Delete button */}
          <button
            type="button"
            className="absolute top-2 right-2 opacity-0 group-hover/line:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); removeLine(i); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {/* Primary text (EN or ES depending on language) */}
          <InlineEditableText
            value={language === 'es' ? (line.text_es || '') : line.text_en}
            onChange={(v) => updateLine(i, language === 'es' ? 'text_es' : 'text_en', v, true)}
            onCommit={(v) => updateLine(i, language === 'es' ? 'text_es' : 'text_en', v)}
            onFocus={() => selectElement(element.key)}
            placeholder={`Line ${i + 1}...`}
            className="text-[15px] font-medium text-foreground leading-[1.55]"
            multiline
            minHeight="min-h-[20px]"
          />

          {/* Secondary text (opposite language) */}
          <InlineEditableText
            value={language === 'es' ? line.text_en : (line.text_es || '')}
            onChange={(v) => updateLine(i, language === 'es' ? 'text_en' : 'text_es', v, true)}
            onCommit={(v) => updateLine(i, language === 'es' ? 'text_en' : 'text_es', v)}
            onFocus={() => selectElement(element.key)}
            placeholder={language === 'es' ? 'English...' : 'Español...'}
            className="text-[13px] text-muted-foreground/70 italic leading-[1.55] mt-1"
            multiline
            minHeight="min-h-[16px]"
          />
        </div>
      ))}

      {/* Add line button */}
      <button
        type="button"
        className="w-full px-6 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
        onClick={(e) => { e.stopPropagation(); addLine(); }}
      >
        <Plus className="h-3.5 w-3.5" />
        {language === 'es' ? 'Agregar línea' : 'Add line'}
      </button>
    </div>
  );
}
