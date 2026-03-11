// =============================================================================
// FeatureElementRenderer — WYSIWYG inline editing for feature callouts.
// Matches PlayerFeatureRenderer CSS exactly.
// 7 variants: tip, best_practice, caution, warning, did_you_know, key_point, standout
// =============================================================================

import { cn } from '@/lib/utils';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { InlineEditableText } from '@/components/course-builder/InlineEditableText';
import { ElementConfigBar } from '@/components/course-builder/ElementConfigBar';
import { FEATURE_VARIANTS } from '@/lib/course-builder/builder-utils';
import type { FeatureElement, FeatureVariant } from '@/types/course-builder';

interface FeatureElementRendererProps {
  element: FeatureElement;
  language: 'en' | 'es';
  isSelected?: boolean;
}

export function FeatureElementRenderer({ element, language, isSelected }: FeatureElementRendererProps) {
  const { updateElement, updateElementSilent, selectElement } = useCourseBuilder();

  const variantConfig = FEATURE_VARIANTS[element.variant] || FEATURE_VARIANTS.tip;
  const titleKey = language === 'es' ? 'title_es' : 'title_en';
  const bodyKey = language === 'es' ? 'body_es' : 'body_en';
  const titleValue = (language === 'es' ? (element.title_es || element.title_en) : element.title_en) || '';
  const bodyValue = (language === 'es' ? (element.body_es || element.body_en) : element.body_en) || '';
  const variantLabel = language === 'es' ? variantConfig.labelEs : variantConfig.labelEn;

  // Variant selector (shared by both layouts)
  const variantSelector = (
    <ElementConfigBar isSelected={isSelected}>
      <select
        value={element.variant}
        onChange={(e) => {
          const newVariant = e.target.value as FeatureVariant;
          const newConfig = FEATURE_VARIANTS[newVariant];
          updateElement(element.key, { variant: newVariant, icon: newConfig.icon });
        }}
        className="text-[10px] bg-transparent border-0 outline-none cursor-pointer font-semibold uppercase"
      >
        {(Object.entries(FEATURE_VARIANTS) as [FeatureVariant, typeof variantConfig][]).map(([v, c]) => (
          <option key={v} value={v}>{language === 'es' ? c.labelEs : c.labelEn}</option>
        ))}
      </select>
    </ElementConfigBar>
  );

  // Standout variant: dark banner
  if (element.variant === 'standout') {
    return (
      <div className="bg-foreground rounded-[20px] py-8 px-7 relative overflow-hidden mt-8 group/config">
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

        {variantSelector}

        {/* Tag */}
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5 relative z-10', variantConfig.tagColor)}>
          {/* Icon (clickable emoji) */}
          <InlineEditableText
            value={element.icon || ''}
            onChange={(v) => updateElementSilent(element.key, { icon: v })}
            onCommit={(v) => updateElement(element.key, { icon: v })}
            onFocus={() => selectElement(element.key)}
            placeholder="📣"
            className="text-[10px] w-5"
            darkBg
            minHeight="min-h-[14px]"
          />
          <span>{variantLabel}</span>
        </div>

        {/* Title */}
        <InlineEditableText
          value={titleValue}
          onChange={(v) => updateElementSilent(element.key, { [titleKey]: v })}
          onCommit={(v) => updateElement(element.key, { [titleKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Título...' : 'Title...'}
          className="text-[clamp(1.25rem,3.5vw,1.5rem)] font-extrabold text-white leading-[1.2] tracking-[-0.01em] mb-2.5 max-w-[32ch] relative z-10"
          darkBg
          minHeight="min-h-[32px]"
        />

        {/* Body */}
        <InlineEditableText
          value={bodyValue}
          onChange={(v) => updateElementSilent(element.key, { [bodyKey]: v })}
          onCommit={(v) => updateElement(element.key, { [bodyKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Contenido...' : 'Content...'}
          className="text-sm text-white/60 leading-[1.65] max-w-[52ch] relative z-10 break-words"
          markdown
          multiline
          darkBg
          minHeight="min-h-[40px]"
        />
      </div>
    );
  }

  // Standard callout: card with icon tile
  const cardBg = variantConfig.cardBg || 'bg-card';
  const borderClass = variantConfig.cardBg
    ? `border ${variantConfig.cardBg === 'bg-orange-50' ? 'border-orange-200' : 'border-black/[0.04]'}`
    : 'border border-black/[0.04]';

  return (
    <div className={cn('rounded-[20px] shadow-sm p-6 flex gap-4 items-start mt-6 relative group/config', cardBg, borderClass)}>
      {variantSelector}

      {/* Icon tile — always render */}
      <div
        className={cn(
          'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br',
          variantConfig.iconTileBg,
          !element.icon && 'border-2 border-dashed border-current/20',
        )}
      >
        <InlineEditableText
          value={element.icon || ''}
          onChange={(v) => updateElementSilent(element.key, { icon: v })}
          onCommit={(v) => updateElement(element.key, { icon: v })}
          onFocus={() => selectElement(element.key)}
          placeholder="💡"
          className="text-[22px] text-center w-full"
          minHeight="min-h-[22px]"
        />
      </div>

      <div className="flex-1 min-w-0">
        {/* Tag */}
        <div className={cn('text-[10px] font-bold uppercase tracking-[0.06em] mb-0.5', variantConfig.tagColor)}>
          {variantLabel}
        </div>

        {/* Title */}
        <InlineEditableText
          value={titleValue}
          onChange={(v) => updateElementSilent(element.key, { [titleKey]: v })}
          onCommit={(v) => updateElement(element.key, { [titleKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Título (opcional)...' : 'Title (optional)...'}
          className="text-[15px] font-bold text-foreground mb-1"
          minHeight="min-h-[20px]"
        />

        {/* Body */}
        <InlineEditableText
          value={bodyValue}
          onChange={(v) => updateElementSilent(element.key, { [bodyKey]: v })}
          onCommit={(v) => updateElement(element.key, { [bodyKey]: v })}
          onFocus={() => selectElement(element.key)}
          placeholder={language === 'es' ? 'Contenido...' : 'Content...'}
          className="break-words text-[13px] text-muted-foreground leading-relaxed"
          markdown
          multiline
          minHeight="min-h-[24px]"
        />
      </div>
    </div>
  );
}
