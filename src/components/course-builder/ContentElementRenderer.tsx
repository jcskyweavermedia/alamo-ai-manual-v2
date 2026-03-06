// =============================================================================
// ContentElementRenderer — Renders content elements
// Outline state: shows title + ai_instructions as editable prompt
// Generated state: renders Markdown body
// =============================================================================

import { useState } from 'react';
import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { courseMdComponents } from '@/lib/chat-markdown';
import { stripDuplicateLeadingHeading } from '@/lib/course-builder/builder-utils';
import type { ContentElement } from '@/types/course-builder';

interface ContentElementRendererProps {
  element: ContentElement;
  language: 'en' | 'es';
}

export function ContentElementRenderer({ element, language }: ContentElementRendererProps) {
  const { updateElement } = useCourseBuilder();
  const [isEditing, setIsEditing] = useState(false);

  const title = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const rawBody = language === 'es' ? (element.body_es || element.body_en) : element.body_en;
  const body = rawBody ? stripDuplicateLeadingHeading(rawBody, title) : rawBody;

  if (element.status === 'outline') {
    // Outline state: show instructions for AI generation
    return (
      <div className="space-y-2">
        <Input
          value={element.title_en || ''}
          onChange={(e) => updateElement(element.key, { title_en: e.target.value })}
          placeholder={language === 'es' ? 'Titulo del contenido...' : 'Content title...'}
          className="h-8 text-sm font-medium border-dashed"
        />
        <Textarea
          value={element.ai_instructions}
          onChange={(e) => updateElement(element.key, { ai_instructions: e.target.value })}
          placeholder={language === 'es'
            ? 'Instrucciones para IA: Que deberia cubrir esta seccion?'
            : 'AI instructions: What should this section cover?'}
          className="min-h-[60px] text-sm border-dashed"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        {element.source_refs.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {element.source_refs.length} source{element.source_refs.length > 1 ? 's' : ''} linked
          </p>
        )}
      </div>
    );
  }

  // Generated/reviewed state: render content
  if (isEditing) {
    return (
      <div className="space-y-2">
        <Input
          value={language === 'es' ? (element.title_es || '') : (element.title_en || '')}
          onChange={(e) => {
            const key = language === 'es' ? 'title_es' : 'title_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          className="h-8 text-sm font-medium"
        />
        <Textarea
          value={body}
          onChange={(e) => {
            const key = language === 'es' ? 'body_es' : 'body_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          className="min-h-[120px] text-sm font-mono resize-none"
        />
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="text-xs text-primary hover:underline"
        >
          {language === 'es' ? 'Ver vista previa' : 'Preview'}
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-1 cursor-text"
      onDoubleClick={() => setIsEditing(true)}
    >
      {title && (
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          {title}
        </h3>
      )}
      {body ? (
        <div className="break-words">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>
            {body}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {language === 'es' ? 'Doble clic para editar' : 'Double-click to edit'}
        </p>
      )}
    </div>
  );
}
