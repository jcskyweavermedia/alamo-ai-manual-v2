// =============================================================================
// PlayerFeatureRenderer — Read-only feature callout renderer for the course player.
// Renders variant-styled callout box with icon, label, title, and Markdown body.
// =============================================================================

import { Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { courseMdComponents } from '@/lib/chat-markdown';
import { FEATURE_VARIANTS, FEATURE_ICON_MAP } from '@/lib/course-builder/builder-utils';
import type { FeatureElement } from '@/types/course-builder';

interface Props {
  element: FeatureElement;
  language: 'en' | 'es';
}

export function PlayerFeatureRenderer({ element, language }: Props) {
  const variantConfig = FEATURE_VARIANTS[element.variant] || FEATURE_VARIANTS.tip;
  const Icon = FEATURE_ICON_MAP[variantConfig.icon] || Lightbulb;
  const title = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const body = language === 'es' ? (element.body_es || element.body_en) : element.body_en;
  const variantLabel = language === 'es' ? variantConfig.labelEs : variantConfig.labelEn;

  return (
    <div className={cn('rounded-lg p-3', variantConfig.bgClass, variantConfig.borderClass)}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-current/60">
            {variantLabel}
          </span>
          {title && (
            <h4 className="text-base font-bold mt-1 mb-2">{title}</h4>
          )}
          {body ? (
            <div className="break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>
                {body}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm mt-1 text-current/50 italic">
              {language === 'es' ? 'Sin contenido' : 'No content'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
