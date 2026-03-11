// =============================================================================
// PlayerFeatureRenderer — Read-only feature callout renderer for the course player.
// Card-based design with icon tiles. Standout variant for dark banners.
// =============================================================================

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { courseMdComponents } from '@/lib/chat-markdown';
import { FEATURE_VARIANTS } from '@/lib/course-builder/builder-utils';
import type { FeatureElement } from '@/types/course-builder';

interface Props {
  element: FeatureElement;
  language: 'en' | 'es';
}

export function PlayerFeatureRenderer({ element, language }: Props) {
  const variantConfig = FEATURE_VARIANTS[element.variant] || FEATURE_VARIANTS.tip;
  const title = language === 'es' ? (element.title_es || element.title_en) : element.title_en;
  const body = language === 'es' ? (element.body_es || element.body_en) : element.body_en;
  const variantLabel = language === 'es' ? variantConfig.labelEs : variantConfig.labelEn;

  // Standout variant: dark banner with radial glow
  if (element.variant === 'standout') {
    return (
      <div className="bg-foreground rounded-[20px] py-8 px-7 relative overflow-hidden mt-8">
        {/* Radial glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-40%', right: '-15%', width: '55%', height: '180%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #EA580C 0%, transparent 65%)',
            opacity: 0.08,
          }}
        />
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5 relative z-10', variantConfig.tagColor)}>
          {element.icon && <span>{element.icon}</span>}
          {variantLabel}
        </div>
        {title && (
          <h3 className="text-[clamp(1.25rem,3.5vw,1.5rem)] font-extrabold text-white leading-[1.2] tracking-[-0.01em] mb-2.5 max-w-[32ch] relative z-10">
            {title}
          </h3>
        )}
        {body ? (
          <div className="text-sm text-white/60 leading-[1.65] max-w-[52ch] relative z-10 break-words [&_p]:text-white/60 [&_li]:text-white/60 [&_strong]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_blockquote]:text-white/50">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>
              {body}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-white/40 italic relative z-10">
            {language === 'es' ? 'Sin contenido' : 'No content'}
          </p>
        )}
      </div>
    );
  }

  // Standard callout: white card with icon tile
  const cardBg = variantConfig.cardBg || 'bg-card';
  const borderClass = variantConfig.cardBg
    ? `border ${variantConfig.cardBg === 'bg-orange-50' ? 'border-orange-200' : 'border-black/[0.04]'}`
    : 'border border-black/[0.04]';

  return (
    <div className={cn('rounded-[20px] shadow-sm p-6 flex gap-4 items-start mt-6', cardBg, borderClass)}>
      {/* Icon tile */}
      {element.icon && (
        <div
          className={cn(
            'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-[22px]',
            variantConfig.iconTileBg,
          )}
        >
          {element.icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.06em] mb-0.5', variantConfig.tagColor)}>
          {variantLabel}
        </div>
        {title && (
          <h4 className="text-[15px] font-bold text-foreground mb-1">{title}</h4>
        )}
        {body ? (
          <div className="break-words text-[13px] text-muted-foreground leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={courseMdComponents}>
              {body}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {language === 'es' ? 'Sin contenido' : 'No content'}
          </p>
        )}
      </div>
    </div>
  );
}
