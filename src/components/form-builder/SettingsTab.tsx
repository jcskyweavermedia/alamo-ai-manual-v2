// =============================================================================
// SettingsTab — Settings panel for the Form Builder
//
// Sections:
// - Title EN/ES inputs
// - Description EN/ES textareas
// - Icon picker (emoji grid with color swatches)
// - Slug input (auto-generated from title, locked after publish)
// - Status display
//
// All grouped in card-style sections per the UX plan visual language.
// Dispatches individual SET_TITLE_EN, SET_SLUG, SET_ICON, etc. actions.
// =============================================================================

import { useState, useCallback } from 'react';
import { Globe, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { FORM_EMOJI_OPTIONS, ICON_COLORS, resolveIcon } from '@/lib/form-builder/icon-utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// generateSlug is now handled by the context's setTitleEn convenience action

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    formDetails: 'Form Details',
    titleEn: 'Title (English)',
    titleEs: 'Title (Spanish)',
    titlePlaceholder: 'e.g., Employee Write-Up',
    titleEsPlaceholder: 'e.g., Escrito de Empleado',
    descriptionEn: 'Description (English)',
    descriptionEs: 'Description (Spanish)',
    descriptionPlaceholder: 'Brief description of this form...',
    descriptionEsPlaceholder: 'Descripcion breve de este formulario...',
    appearance: 'Appearance',
    icon: 'Icon',
    selectEmoji: 'Select emoji',
    color: 'Color',
    slug: 'URL Slug',
    slugPlaceholder: 'employee-write-up',
    slugLocked: 'Locked (published)',
    slugHint: 'Auto-generated from title. Used in the form URL.',
    status: 'Status',
    version: 'Version',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
  },
  es: {
    formDetails: 'Detalles del Formulario',
    titleEn: 'Titulo (Ingles)',
    titleEs: 'Titulo (Espanol)',
    titlePlaceholder: 'ej., Employee Write-Up',
    titleEsPlaceholder: 'ej., Escrito de Empleado',
    descriptionEn: 'Descripcion (Ingles)',
    descriptionEs: 'Descripcion (Espanol)',
    descriptionPlaceholder: 'Descripcion breve de este formulario...',
    descriptionEsPlaceholder: 'Descripcion breve de este formulario...',
    appearance: 'Apariencia',
    icon: 'Icono',
    selectEmoji: 'Seleccionar emoji',
    color: 'Color',
    slug: 'Slug de URL',
    slugPlaceholder: 'escrito-de-empleado',
    slugLocked: 'Bloqueado (publicado)',
    slugHint: 'Auto-generado desde el titulo. Usado en la URL del formulario.',
    status: 'Estado',
    version: 'Version',
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
  },
} as const;

// =============================================================================
// STATUS BADGE STYLES
// =============================================================================

const STATUS_STYLES = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  archived: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function SettingsTab({ language }: { language: 'en' | 'es' }) {
  const { state, dispatch, setTitleEn } = useBuilder();
  const t = STRINGS[language];
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // Slug is locked after template has been published at least once
  const isSlugLocked = state.status === 'published' || !!state.publishedAt;

  // Resolve the current icon + color to emoji + bg classes
  const iconConfig = resolveIcon(state.icon, state.iconColor);

  // --- Handlers ---

  const handleTitleEnChange = useCallback(
    (value: string) => {
      setTitleEn(value);
    },
    [setTitleEn],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      dispatch({ type: 'SET_SLUG', payload: sanitized });
    },
    [dispatch],
  );

  return (
    <div className="space-y-6 pb-8">
      {/* ================================================================= */}
      {/* FORM DETAILS CARD                                                */}
      {/* ================================================================= */}
      <section
        className={cn(
          'rounded-[20px] border border-black/[0.04] dark:border-white/[0.06]',
          'bg-card shadow-card p-5',
        )}
      >
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
          {t.formDetails}
        </h2>

        <div className="space-y-4">
          {/* Title ES */}
          <div>
            <label
              htmlFor="title-es"
              className="text-sm font-medium text-foreground"
            >
              {t.titleEs}
            </label>
            <Input
              id="title-es"
              value={state.titleEs}
              onChange={e =>
                dispatch({ type: 'SET_TITLE_ES', payload: e.target.value })
              }
              placeholder={t.titleEsPlaceholder}
              className="mt-1.5"
            />
          </div>

          {/* Description EN */}
          <div>
            <label
              htmlFor="desc-en"
              className="text-sm font-medium text-foreground"
            >
              {t.descriptionEn}
            </label>
            <Textarea
              id="desc-en"
              value={state.descriptionEn}
              onChange={e =>
                dispatch({
                  type: 'SET_DESCRIPTION_EN',
                  payload: e.target.value,
                })
              }
              placeholder={t.descriptionPlaceholder}
              rows={3}
              className="mt-1.5 resize-y"
            />
          </div>

          {/* Description ES */}
          <div>
            <label
              htmlFor="desc-es"
              className="text-sm font-medium text-foreground"
            >
              {t.descriptionEs}
            </label>
            <Textarea
              id="desc-es"
              value={state.descriptionEs}
              onChange={e =>
                dispatch({
                  type: 'SET_DESCRIPTION_ES',
                  payload: e.target.value,
                })
              }
              placeholder={t.descriptionEsPlaceholder}
              rows={3}
              className="mt-1.5 resize-y"
            />
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* APPEARANCE CARD (Icon + Slug)                                    */}
      {/* ================================================================= */}
      <section
        className={cn(
          'rounded-[20px] border border-black/[0.04] dark:border-white/[0.06]',
          'bg-card shadow-card p-5',
        )}
      >
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
          {t.appearance}
        </h2>

        <div className="space-y-4">
          {/* Icon picker */}
          <div>
            <label className="text-sm font-medium text-foreground">
              {t.icon}
            </label>
            <div className="mt-1.5">
              <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start gap-3 font-normal text-sm"
                  >
                    <div className={cn('flex items-center justify-center shrink-0 w-8 h-8 rounded-[10px]', iconConfig.bg, iconConfig.darkBg)}>
                      <span className="text-[18px] leading-none">{iconConfig.emoji}</span>
                    </div>
                    <span className="truncate">{state.icon}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[320px] p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {t.selectEmoji}
                  </p>
                  {/* Emoji grid -- 6 columns */}
                  <div className="grid grid-cols-6 gap-1.5 max-h-[240px] overflow-y-auto">
                    {FORM_EMOJI_OPTIONS.map(entry => {
                      const isSelected = state.icon === entry.emoji;
                      return (
                        <button
                          key={entry.emoji}
                          type="button"
                          onClick={() => {
                            dispatch({ type: 'SET_ICON', payload: entry.emoji });
                            setIconPickerOpen(false);
                          }}
                          className={cn(
                            'flex items-center justify-center',
                            'h-10 w-10 rounded-[12px]',
                            'transition-colors duration-100',
                            isSelected
                              ? 'bg-primary/15 ring-2 ring-primary'
                              : 'hover:bg-muted',
                          )}
                          title={entry.label}
                          aria-label={entry.label}
                        >
                          <span className="text-[20px] leading-none">{entry.emoji}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Color swatches */}
                  <p className="text-xs font-medium text-muted-foreground mt-3 mb-2">
                    {t.color}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(ICON_COLORS).map(([colorName, colorClasses]) => {
                      const isSelected = (state.iconColor || 'blue') === colorName;
                      return (
                        <button
                          key={colorName}
                          type="button"
                          onClick={() => dispatch({ type: 'SET_ICON_COLOR', payload: colorName })}
                          className={cn(
                            'h-7 w-7 rounded-full transition-all duration-100',
                            colorClasses.bg, colorClasses.darkBg,
                            isSelected && 'ring-2 ring-offset-2 ring-primary',
                          )}
                          title={colorName}
                          aria-label={`${colorName} background`}
                        />
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Slug */}
          <div>
            <label
              htmlFor="slug"
              className="text-sm font-medium text-foreground flex items-center gap-2"
            >
              {t.slug}
              {isSlugLocked && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-normal">
                  <Lock className="h-3 w-3" />
                  {t.slugLocked}
                </span>
              )}
            </label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                id="slug"
                value={state.slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder={t.slugPlaceholder}
                disabled={isSlugLocked}
                className={cn(
                  'font-mono text-sm',
                  isSlugLocked && 'bg-muted cursor-not-allowed',
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {t.slugHint}
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* STATUS & VERSION CARD                                            */}
      {/* ================================================================= */}
      <section
        className={cn(
          'rounded-[20px] border border-black/[0.04] dark:border-white/[0.06]',
          'bg-card shadow-card p-5',
        )}
      >
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
          {t.status}
        </h2>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t.status}:
            </span>
            <Badge
              className={cn(
                'text-xs font-semibold border-0 capitalize',
                STATUS_STYLES[state.status],
              )}
            >
              {t[state.status]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {t.version}:
            </span>
            <span className="text-sm text-muted-foreground">
              v{state.templateVersion}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
