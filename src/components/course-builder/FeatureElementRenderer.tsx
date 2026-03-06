// =============================================================================
// FeatureElementRenderer — Renders feature callout elements with variant colors
// 6 variants: tip, best_practice, caution, warning, did_you_know, key_point
// =============================================================================

import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { courseMdComponents } from '@/lib/chat-markdown';
import { FEATURE_VARIANTS, FEATURE_ICON_MAP } from '@/lib/course-builder/builder-utils';
import type { FeatureElement, FeatureVariant } from '@/types/course-builder';

interface FeatureElementRendererProps {
  element: FeatureElement;
  language: 'en' | 'es';
}

export function FeatureElementRenderer({ element, language }: FeatureElementRendererProps) {
  const { updateElement } = useCourseBuilder();
  const [isEditing, setIsEditing] = useState(false);

  const variantConfig = FEATURE_VARIANTS[element.variant] || FEATURE_VARIANTS.tip;
  const Icon = FEATURE_ICON_MAP[variantConfig.icon] || Lightbulb;
  const title = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const body = language === 'es' ? (element.body_es || element.body_en) : element.body_en;
  const variantLabel = language === 'es' ? variantConfig.labelEs : variantConfig.labelEn;

  if (element.status === 'outline') {
    return (
      <div className={cn('rounded-lg p-3', variantConfig.bgClass, variantConfig.borderClass)}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{variantLabel}</span>
        </div>
        <Textarea
          value={element.ai_instructions}
          onChange={(e) => updateElement(element.key, { ai_instructions: e.target.value })}
          placeholder={language === 'es'
            ? 'Instrucciones para IA: Que deberia incluir este callout?'
            : 'AI instructions: What should this callout include?'}
          className="min-h-[40px] text-sm border-dashed bg-white/50 dark:bg-black/20"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={cn('rounded-lg p-3 space-y-2', variantConfig.bgClass, variantConfig.borderClass)}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0" />
          {/* Variant selector */}
          <select
            value={element.variant}
            onChange={(e) => {
              const newVariant = e.target.value as FeatureVariant;
              const newConfig = FEATURE_VARIANTS[newVariant];
              updateElement(element.key, { variant: newVariant, icon: newConfig.icon });
            }}
            className="text-xs font-semibold uppercase bg-transparent border-0 outline-none cursor-pointer"
          >
            {(Object.entries(FEATURE_VARIANTS) as [FeatureVariant, typeof variantConfig][]).map(([v, c]) => (
              <option key={v} value={v}>{language === 'es' ? c.labelEs : c.labelEn}</option>
            ))}
          </select>
        </div>
        <Input
          value={language === 'es' ? (element.title_es || '') : (element.title_en || '')}
          onChange={(e) => {
            const key = language === 'es' ? 'title_es' : 'title_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          placeholder={language === 'es' ? 'Titulo (opcional)...' : 'Title (optional)...'}
          className="h-7 text-sm font-medium bg-white/50 dark:bg-black/20"
        />
        <Textarea
          value={body}
          onChange={(e) => {
            const key = language === 'es' ? 'body_es' : 'body_en';
            updateElement(element.key, { [key]: e.target.value });
          }}
          className="min-h-[60px] text-sm resize-none bg-white/50 dark:bg-black/20"
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
      className={cn('rounded-lg p-3', variantConfig.bgClass, variantConfig.borderClass)}
      onDoubleClick={() => setIsEditing(true)}
    >
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
              {language === 'es' ? 'Doble clic para editar' : 'Double-click to edit'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
