// =============================================================================
// PlayerContentRenderer — Read-only content renderer for the course player.
// Renders title + Markdown body. No edit mode, no context dependency.
// =============================================================================

import { FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { courseMdComponents } from '@/lib/chat-markdown';
import { stripDuplicateLeadingHeading } from '@/lib/course-builder/builder-utils';
import type { ContentElement } from '@/types/course-builder';

interface Props {
  element: ContentElement;
  language: 'en' | 'es';
}

export function PlayerContentRenderer({ element, language }: Props) {
  const title = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const rawBody = language === 'es' ? (element.body_es || element.body_en) : element.body_en;
  const body = rawBody ? stripDuplicateLeadingHeading(rawBody, title || '') : rawBody;

  return (
    <div className="space-y-1">
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
          {language === 'es' ? 'Sin contenido' : 'No content'}
        </p>
      )}
    </div>
  );
}
