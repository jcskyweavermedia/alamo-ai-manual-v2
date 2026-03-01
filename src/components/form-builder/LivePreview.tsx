// =============================================================================
// LivePreview — Phone-frame live preview of the form being built
// Reuses FormBody/FormSection/FormFieldRenderer for rendering
// Gets state from useBuilder() context
// =============================================================================

import { useState, useMemo } from 'react';
import { ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { FormBody } from '@/components/forms/FormBody';
import { AIFillabilityIndicator } from '@/components/form-builder/AIFillabilityIndicator';
import { computeAiFillabilityScore } from '@/lib/form-builder/builder-utils';
import type { FormFieldValue } from '@/types/forms';

const STRINGS = {
  en: {
    preview: 'Preview',
    mobile: 'Mobile',
    desktop: 'Desktop',
    en: 'EN',
    es: 'ES',
    emptyTitle: 'Untitled Form',
    emptyState: 'Add fields to see a preview.',
    openInNewTab: 'Open in new tab',
  },
  es: {
    preview: 'Vista Previa',
    mobile: 'Movil',
    desktop: 'Escritorio',
    en: 'EN',
    es: 'ES',
    emptyTitle: 'Formulario sin titulo',
    emptyState: 'Agrega campos para ver una vista previa.',
    openInNewTab: 'Abrir en nueva pestana',
  },
};

interface LivePreviewProps {
  language: 'en' | 'es';
}

export function LivePreview({ language }: LivePreviewProps) {
  const { state, dispatch } = useBuilder();
  const [previewLanguage, setPreviewLanguage] = useState<'en' | 'es'>(language);
  const t = STRINGS[language] || STRINGS.en;

  // Compute AI fillability score
  const fillability = useMemo(
    () => computeAiFillabilityScore(state.fields, state.instructionsEn, state.aiTools),
    [state.fields, state.instructionsEn, state.aiTools],
  );

  // No-op change handler for read-only preview
  const noopChange = (_key: string, _value: FormFieldValue) => {};

  // Resolve title for the preview
  const previewTitle = previewLanguage === 'es'
    ? (state.titleEs || state.titleEn || t.emptyTitle)
    : (state.titleEn || t.emptyTitle);

  const previewDescription = previewLanguage === 'es'
    ? (state.descriptionEs || state.descriptionEn || '')
    : (state.descriptionEn || '');

  const hasFields = state.fields.length > 0;
  const canOpenInNewTab = !!state.templateId && !!state.slug;

  return (
    <div className="sticky top-4 space-y-5">
      {/* Header bar: title + mode toggle + language toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.preview}
        </h3>
        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <div className="flex rounded-lg border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
            {(['en', 'es'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setPreviewLanguage(lang)}
                className={cn(
                  'text-[11px] font-semibold px-2.5 py-1 transition-colors uppercase',
                  previewLanguage === lang
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground',
                )}
              >
                {lang}
              </button>
            ))}
          </div>
          {/* Preview mode toggle */}
          <div className="flex rounded-lg border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
            <button
              onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', payload: 'mobile' })}
              className={cn(
                'p-1.5 transition-colors',
                state.previewMode === 'mobile'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground',
              )}
              title={t.mobile}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', payload: 'desktop' })}
              className={cn(
                'p-1.5 transition-colors',
                state.previewMode === 'desktop'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground',
              )}
              title={t.desktop}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Phone frame */}
      {state.previewMode === 'mobile' ? (
        <div className="mx-auto w-[375px]">
          <div
            className={cn(
              'rounded-[40px]',
              'border-[6px] border-foreground/10 dark:border-foreground/5',
              'bg-background',
              'shadow-xl',
              'overflow-hidden',
            )}
          >
            {/* Notch */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-[120px] h-[28px] rounded-full bg-foreground/10" />
            </div>

            {/* Scrollable content area */}
            <div className="overflow-y-auto max-h-[580px] px-4 pt-2 pb-16">
              {/* Form title + description */}
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">
                  {previewTitle}
                </h2>
                {previewDescription && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {previewDescription}
                  </p>
                )}
              </div>

              {/* Form fields or empty state */}
              {hasFields ? (
                <div className="pointer-events-none">
                  <FormBody
                    fields={state.fields}
                    values={{}}
                    errors={{}}
                    language={previewLanguage}
                    onFieldChange={noopChange}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground text-center">
                    {t.emptyState}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom home indicator bar */}
            <div className="flex justify-center pb-2">
              <div className="w-[120px] h-[4px] rounded-full bg-foreground/15" />
            </div>
          </div>
        </div>
      ) : (
        /* Desktop preview mode -- full width, no phone frame */
        <div
          className={cn(
            'w-full rounded-[20px]',
            'border border-black/[0.04] dark:border-white/[0.06]',
            'bg-background shadow-card',
            'overflow-hidden',
          )}
        >
          <div className="overflow-y-auto max-h-[580px] px-6 py-5">
            {/* Form title + description */}
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-foreground">
                {previewTitle}
              </h2>
              {previewDescription && (
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {previewDescription}
                </p>
              )}
            </div>

            {/* Form fields or empty state */}
            {hasFields ? (
              <div className="pointer-events-none">
                <FormBody
                  fields={state.fields}
                  values={{}}
                  errors={{}}
                  language={previewLanguage}
                  onFieldChange={noopChange}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-40">
                <p className="text-sm text-muted-foreground text-center">
                  {t.emptyState}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Fillability Score */}
      <div
        className={cn(
          'rounded-[20px]',
          'border border-black/[0.04] dark:border-white/[0.06]',
          'bg-card shadow-card',
          'px-5 py-5',
        )}
      >
        <AIFillabilityIndicator
          score={fillability.score}
          issues={fillability.issues}
          language={language}
        />
      </div>

      {/* Open in new tab link */}
      {canOpenInNewTab && (
        <div className="flex justify-center">
          <a
            href={`/forms/${state.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1.5',
              'text-xs font-medium text-primary',
              'hover:underline transition-colors',
            )}
          >
            {t.openInNewTab}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
}
