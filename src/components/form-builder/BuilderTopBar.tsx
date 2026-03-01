// =============================================================================
// BuilderTopBar — Top header bar for the Form Builder page
//
// Features:
// - Back button (navigates to /admin/forms)
// - Inline-editable form title
// - Status badge (Draft / Published with color coding)
// - Slug display (read-only after publish, editable before)
// - Save + Publish buttons (desktop), compact on mobile
// - Save status indicator
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Globe,
  Loader2,
  Check,
  Undo2,
  Redo2,
  Eye,
  AlertTriangle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBuilder } from '@/contexts/BuilderContext';
import { useFormBuilder } from '@/hooks/useFormBuilder';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PreviewModal } from './PreviewModal';
import { validateForPublish } from '@/lib/form-builder/publish-validation';
import type { BuilderTopBarProps, ValidationError } from '@/types/form-builder';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    back: 'Back',
    untitled: 'Untitled Form',
    saveDraft: 'Save Draft',
    saving: 'Saving...',
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
    publish: 'Publish',
    publishChanges: 'Publish Changes',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    unpublishedChanges: 'Unpublished changes',
    slug: 'Slug',
    undo: 'Undo',
    redo: 'Redo',
  },
  es: {
    back: 'Volver',
    untitled: 'Formulario sin titulo',
    saveDraft: 'Guardar',
    saving: 'Guardando...',
    saved: 'Guardado',
    unsaved: 'Cambios sin guardar',
    error: 'Error al guardar',
    publish: 'Publicar',
    publishChanges: 'Publicar Cambios',
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
    unpublishedChanges: 'Cambios sin publicar',
    slug: 'Slug',
    undo: 'Deshacer',
    redo: 'Rehacer',
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

export function BuilderTopBar({ language, onSave }: BuilderTopBarProps) {
  const navigate = useNavigate();
  const {
    state,
    dispatch,
    saveDraft,
    undo,
    redo,
    canUndo,
    canRedo,
    setTitleEn,
  } = useBuilder();
  const { publishTemplate } = useFormBuilder();
  const queryClient = useQueryClient();

  const t = STRINGS[language];
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingSlug, setIsEditingSlug] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publishErrors, setPublishErrors] = useState<ValidationError[] | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Slug is locked after template has been published at least once
  const isSlugLocked = state.status === 'published' || !!state.publishedAt;

  // --- Handlers ---

  const handleBack = useCallback(() => {
    if (state.isDirty) {
      const confirmed = window.confirm(
        language === 'en'
          ? 'You have unsaved changes. Are you sure you want to leave?'
          : 'Tienes cambios sin guardar. Estas seguro de que quieres salir?',
      );
      if (!confirmed) return;
    }
    navigate('/admin/forms');
  }, [state.isDirty, navigate, language]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitleEn(value);
    },
    [setTitleEn],
  );

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
      }
    },
    [],
  );

  const handleSlugChange = useCallback(
    (value: string) => {
      // Force lowercase, hyphens only
      const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-');
      dispatch({ type: 'SET_SLUG', payload: sanitized });
    },
    [dispatch],
  );

  const handlePublishClick = useCallback(() => {
    const { errors } = validateForPublish(state);
    setPublishErrors(errors);
  }, [state]);

  const handlePublishConfirm = useCallback(async () => {
    if (!state.templateId) return;
    setIsPublishing(true);
    try {
      // Save pending changes first
      await saveDraft();
      // Publish via DB (trigger bumps version, sets published_at, clears builder_state)
      const result = await publishTemplate(state.templateId, state);
      if (result.success) {
        dispatch({
          type: 'PUBLISH_CHANGES',
          payload: {
            templateVersion: result.templateVersion,
            publishedAt: result.publishedAt ?? new Date().toISOString(),
          },
        });
        // Invalidate cached form lists so /forms and /admin/forms show the update immediately
        queryClient.invalidateQueries({ queryKey: ['form-templates'] });
        setPublishErrors(null);
      } else {
        // Validation failed — show errors
        setPublishErrors(result.validationErrors ?? null);
      }
    } catch (err) {
      console.error('[Builder] Publish error:', err);
    } finally {
      setIsPublishing(false);
    }
  }, [saveDraft, publishTemplate, state, dispatch]);

  // --- Save status indicator ---
  const saveStatusDisplay = (() => {
    switch (state.saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="hidden sm:inline">{t.saving}</span>
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Check className="h-3 w-3" />
            <span className="hidden sm:inline">{t.saved}</span>
          </span>
        );
      case 'unsaved':
        return (
          <span className="text-xs text-amber-600 dark:text-amber-400 hidden sm:inline">
            {t.unsaved}
          </span>
        );
      case 'error':
        return (
          <span className="text-xs text-destructive hidden sm:inline">
            {t.error}
          </span>
        );
      default:
        return null;
    }
  })();

  // --- Determine publish button label ---
  const publishLabel = state.hasUnpublishedChanges
    ? t.publishChanges
    : t.publish;

  return (
    <header
      className={cn(
        'h-14 shrink-0 border-b',
        'border-black/[0.04] dark:border-white/[0.06]',
        'bg-background',
        'flex items-center gap-2 px-3 sm:px-4',
      )}
    >
      {/* ---- BACK BUTTON ---- */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        className="shrink-0 h-9 w-9"
        aria-label={t.back}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* ---- TITLE (inline editable) ---- */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {isEditingTitle ? (
          <Input
            ref={titleInputRef}
            value={state.titleEn}
            onChange={e => handleTitleChange(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            className="h-8 text-sm font-semibold border-primary/30 max-w-[280px]"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            className={cn(
              'text-sm font-semibold truncate max-w-[200px] sm:max-w-[320px]',
              'text-foreground hover:text-primary transition-colors',
              'cursor-text text-left',
            )}
            title={state.titleEn || t.untitled}
          >
            {state.titleEn || t.untitled}
          </button>
        )}

        {/* Status badge */}
        <Badge
          className={cn(
            'shrink-0 text-[10px] px-2 py-0 h-5 font-semibold uppercase tracking-wider border-0',
            STATUS_STYLES[state.status],
          )}
        >
          {t[state.status]}
        </Badge>

        {/* Unpublished changes indicator */}
        {state.hasUnpublishedChanges && (
          <span className="hidden md:flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.unpublishedChanges}
          </span>
        )}

        {/* Save status (aria-live for accessibility) */}
        <span aria-live="polite" aria-atomic="true">
          {saveStatusDisplay}
        </span>
      </div>

      {/* ---- SLUG (desktop only) ---- */}
      <div className="hidden lg:flex items-center gap-1.5 shrink-0">
        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
        {isSlugLocked || !isEditingSlug ? (
          <button
            type="button"
            onClick={() => !isSlugLocked && setIsEditingSlug(true)}
            className={cn(
              'text-xs text-muted-foreground truncate max-w-[180px]',
              !isSlugLocked && 'hover:text-foreground cursor-text',
              isSlugLocked && 'cursor-default',
            )}
            title={state.slug || 'no-slug'}
            disabled={isSlugLocked}
          >
            /{state.slug || 'untitled-form'}
          </button>
        ) : (
          <Input
            value={state.slug}
            onChange={e => handleSlugChange(e.target.value)}
            onBlur={() => setIsEditingSlug(false)}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-7 text-xs w-[160px] font-mono"
            autoFocus
          />
        )}
      </div>

      {/* ---- UNDO / REDO (desktop only) ---- */}
      <div className="hidden md:flex items-center gap-0.5 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
          className="h-8 w-8"
          aria-label={t.undo}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={redo}
          disabled={!canRedo}
          className="h-8 w-8"
          aria-label={t.redo}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ---- PREVIEW (eye icon) ---- */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setPreviewOpen(true)}
        className="shrink-0 h-8 w-8"
        aria-label={language === 'en' ? 'Preview' : 'Vista previa'}
      >
        <Eye className="h-3.5 w-3.5" />
      </Button>

      {/* ---- SAVE + PUBLISH (desktop) ---- */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void (onSave ? onSave() : saveDraft())}
          disabled={state.isSaving || !state.isDirty}
          className="h-9 gap-1.5"
        >
          {state.isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {t.saveDraft}
        </Button>

        <Button
          size="sm"
          onClick={handlePublishClick}
          disabled={state.isSaving || isPublishing}
          className={cn(
            'h-9',
            state.hasUnpublishedChanges && 'bg-orange-500 hover:bg-orange-600',
          )}
        >
          {isPublishing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : null}
          {publishLabel}
        </Button>
      </div>

      {/* ---- SAVE (mobile only, compact) ---- */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void (onSave ? onSave() : saveDraft())}
        disabled={state.isSaving || !state.isDirty}
        className="sm:hidden shrink-0 h-9 w-9"
        aria-label={t.saveDraft}
      >
        {state.isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !state.isDirty ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Save className="h-4 w-4" />
        )}
      </Button>
      {/* ---- PREVIEW MODAL (full-screen overlay) ---- */}
      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        language={language}
      />

      {/* ---- PUBLISH VALIDATION DIALOG (overlay) ---- */}
      {publishErrors !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-2xl shadow-xl border max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-3">
              <h3 className="text-base font-semibold">
                {publishErrors.some(e => e.severity === 'error')
                  ? (language === 'es' ? 'No se puede publicar' : 'Cannot Publish')
                  : (language === 'es' ? 'Publicar formulario' : 'Publish Form')}
              </h3>
              {!publishErrors.some(e => e.severity === 'error') && publishErrors.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'es'
                    ? 'Todo se ve bien. ¿Publicar este formulario?'
                    : 'Everything looks good. Publish this form?'}
                </p>
              )}
            </div>

            {/* Error/Warning list */}
            {publishErrors.length > 0 && (
              <div className="px-5 pb-3 space-y-2 max-h-[300px] overflow-y-auto">
                {publishErrors.map((err, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-2 rounded-lg px-3 py-2 text-sm',
                      err.severity === 'error'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
                    )}
                  >
                    {err.severity === 'error' ? (
                      <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    )}
                    <span>{err.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 px-5 py-4 border-t bg-muted/30">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPublishErrors(null)}
              >
                {language === 'es' ? 'Cancelar' : 'Cancel'}
              </Button>
              {!publishErrors.some(e => e.severity === 'error') && (
                <Button
                  size="sm"
                  onClick={handlePublishConfirm}
                  disabled={isPublishing}
                >
                  {isPublishing && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                  {language === 'es' ? 'Publicar' : 'Publish'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
