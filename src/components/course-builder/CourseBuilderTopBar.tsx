// =============================================================================
// CourseBuilderTopBar — Top bar with view switcher, device preview, save/publish
// New layout: [Back] [Title] [SaveStatus] [ViewSwitcher] [EN/ES] [Device] [Actions]
// Editor-only: Undo/Redo/Bot shown. Preview-only: Device toggles shown.
// =============================================================================

import { useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Save, Loader2, Sparkles, Smartphone, Tablet, Monitor, Languages } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import { ViewModeSwitcher } from './ViewModeSwitcher';
import type { PreviewDevice } from '@/types/course-builder';

const STRINGS = {
  en: {
    back: 'Back',
    saveDraft: 'Save Draft',
    publish: 'Publish',
    republish: 'Republish',
    saved: 'Saved',
    saving: 'Saving...',
    unsaved: 'Unsaved changes',
    error: 'Save error',
    undo: 'Undo',
    redo: 'Redo',
    titlePlaceholder: 'Course title...',
    buildCourse: 'Build Course',
    hideAi: 'Hide AI Instructions',
    showAi: 'Show AI Instructions',
    hideDraft: 'Hide Draft Content',
    showDraft: 'Show Draft Content',
    translate: 'Translate',
    translating: 'Translating',
    publishDialogTitle: 'Translate before publishing?',
    publishDialogDesc: (untranslated: number, total: number) =>
      `${untranslated} of ${total} sections haven't been translated to Spanish yet.`,
    publishEnOnly: 'Publish EN Only',
    translateAndPublish: 'Translate & Publish',
    translateResult: (ok: number, fail: number) => `${ok} translated, ${fail} failed`,
    translateFailed: 'Translation failed. Publish anyway?',
    depthQuick: 'Quick',
    depthStandard: 'Standard',
    depthDeep: 'Deep Dive',
    depthCustom: 'Custom',
  },
  es: {
    back: 'Volver',
    saveDraft: 'Guardar',
    publish: 'Publicar',
    republish: 'Republicar',
    saved: 'Guardado',
    saving: 'Guardando...',
    unsaved: 'Cambios sin guardar',
    error: 'Error al guardar',
    undo: 'Deshacer',
    redo: 'Rehacer',
    titlePlaceholder: 'T\u00edtulo del curso...',
    buildCourse: 'Construir Curso',
    hideAi: 'Ocultar Instrucciones IA',
    showAi: 'Mostrar Instrucciones IA',
    hideDraft: 'Ocultar Contenido Borrador',
    showDraft: 'Ver Contenido Borrador',
    translate: 'Traducir',
    translating: 'Traduciendo',
    publishDialogTitle: '\u00bfTraducir antes de publicar?',
    publishDialogDesc: (untranslated: number, total: number) =>
      `${untranslated} de ${total} secciones no han sido traducidas al espa\u00f1ol.`,
    publishEnOnly: 'Publicar solo EN',
    translateAndPublish: 'Traducir y Publicar',
    translateResult: (ok: number, fail: number) => `${ok} traducidas, ${fail} fallaron`,
    translateFailed: 'La traducción falló. ¿Publicar de todos modos?',
    depthQuick: 'Rápido',
    depthStandard: 'Estándar',
    depthDeep: 'Profundo',
    depthCustom: 'Personalizado',
  },
};

interface CourseBuilderTopBarProps {
  language: 'en' | 'es';
  onSave?: () => void | Promise<void>;
  onBuildCourse3Pass?: () => void | Promise<void>;
}

const deviceButtons: { key: PreviewDevice; icon: typeof Smartphone; label: string; iconClass?: string }[] = [
  { key: 'phone', icon: Smartphone, label: 'Phone' },
  { key: 'tablet', icon: Tablet, label: 'Tablet' },
  { key: 'tablet-landscape', icon: Tablet, label: 'Tablet Landscape', iconClass: 'rotate-90' },
  { key: 'desktop', icon: Monitor, label: 'Desktop' },
];

export function CourseBuilderTopBar({ language, onSave, onBuildCourse3Pass }: CourseBuilderTopBarProps) {
  const t = STRINGS[language];
  const navigate = useNavigate();
  const {
    state, setTitleEn, canUndo, canRedo, undo, redo, publish, translateCourse,
    setCanvasViewMode, setPreviewDevice, setPreviewLang,
  } = useCourseBuilder();

  const isEditor = state.canvasViewMode === 'editor';
  const isPreview = state.canvasViewMode === 'preview';

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState('');
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  // Computed flags
  const untranslatedCount = state.sections.filter(s => s.generationStatus === 'generated').length;
  const hasUntranslated = untranslatedCount > 0;
  const totalSections = state.sections.length;
  const hasSections = totalSections > 0;
  const allBuilt = hasSections && state.sections.every(
    s => s.generationStatus === 'generated' || s.generationStatus === 'translated' || s.generationStatus === 'reviewed',
  );
  const noneBuilt = !hasSections || state.sections.every(
    s => !s.generationStatus || s.generationStatus === 'empty' || s.generationStatus === 'planned',
  );

  // Handle translate button click
  const handleTranslate = async () => {
    setIsTranslating(true);
    setTranslateProgress(`${t.translating} 0/${untranslatedCount}...`);
    try {
      const result = await translateCourse((completed, total) => {
        setTranslateProgress(`${t.translating} ${completed}/${total}...`);
      });
      if (result.failed > 0) {
        setTranslateProgress(t.translateResult(result.translated, result.failed));
        setTimeout(() => setTranslateProgress(''), 4000);
      } else {
        setTranslateProgress('');
      }
    } catch (err) {
      console.error('[TopBar] translate error:', err);
      setTranslateProgress('');
    } finally {
      setIsTranslating(false);
    }
  };

  // Handle publish with intercept
  const handlePublish = () => {
    if (hasUntranslated) {
      setShowPublishDialog(true);
    } else {
      void publish();
    }
  };

  // Translate & Publish
  const handleTranslateAndPublish = async () => {
    setShowPublishDialog(false);
    setIsTranslating(true);
    setTranslateProgress(`${t.translating} 0/${untranslatedCount}...`);
    try {
      const result = await translateCourse((completed, total) => {
        setTranslateProgress(`${t.translating} ${completed}/${total}...`);
      });
      setTranslateProgress('');
      // Only publish if at least some translations succeeded
      if (result.translated > 0 || result.total === 0) {
        await publish();
      } else {
        // All failed — don't publish, show feedback
        setTranslateProgress(t.translateResult(0, result.failed));
        setTimeout(() => setTranslateProgress(''), 4000);
      }
    } catch (err) {
      console.error('[TopBar] translate & publish error:', err);
      setTranslateProgress('');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
      {/* ── LEFT: Back + Title ── */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => navigate('/admin/courses')}
          aria-label={t.back}
          className={cn(
            'flex items-center justify-center shrink-0',
            'h-9 w-9 rounded-lg',
            'bg-orange-500 text-white',
            'hover:bg-orange-600 active:bg-orange-700',
            'shadow-sm transition-colors duration-150',
          )}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <Input
          value={state.titleEn}
          onChange={(e) => setTitleEn(e.target.value)}
          placeholder={t.titlePlaceholder}
          className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 max-w-[280px]"
        />
      </div>

      {/* ── CENTER: Toolbar (editor tools + view switcher + lang + device) ── */}
      <div className="flex items-center justify-center gap-2">
        {/* Editor-only: Undo / Redo / AI Instructions / Source Panel */}
        {isEditor && (
          <div className="hidden sm:flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            <button
              disabled={!canUndo}
              onClick={undo}
              aria-label={t.undo}
              className={cn(
                'flex items-center justify-center rounded-md h-7 w-7 transition-all',
                canUndo ? 'text-foreground hover:bg-background hover:shadow-sm' : 'text-muted-foreground/40',
              )}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              disabled={!canRedo}
              onClick={redo}
              aria-label={t.redo}
              className={cn(
                'flex items-center justify-center rounded-md h-7 w-7 transition-all',
                canRedo ? 'text-foreground hover:bg-background hover:shadow-sm' : 'text-muted-foreground/40',
              )}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* View Mode Switcher */}
        <ViewModeSwitcher
          value={state.canvasViewMode}
          onChange={setCanvasViewMode}
          language={language}
        />

        {/* Language toggle */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setPreviewLang('en')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold transition-colors',
              state.previewLang === 'en'
                ? 'bg-orange-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            EN
          </button>
          <button
            onClick={() => setPreviewLang('es')}
            className={cn(
              'px-2.5 py-1 text-xs font-semibold transition-colors',
              state.previewLang === 'es'
                ? 'bg-orange-500 text-white'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            ES
          </button>
        </div>

        {/* Preview-only: Device toggle buttons */}
        {isPreview && (
          <div className="hidden lg:flex rounded-lg bg-muted p-0.5 shrink-0">
            {deviceButtons.map(({ key, icon: Icon, label, iconClass }) => (
              <button
                key={key}
                onClick={() => setPreviewDevice(key)}
                title={label}
                aria-label={label}
                className={cn(
                  'flex items-center justify-center rounded-md h-7 w-7 transition-all',
                  state.previewDevice === key
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', iconClass)} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── RIGHT: Actions (Build, Save, Translate, Publish) ── */}
      <div className="flex items-center gap-2">
        {/* Build Course */}
        {state.wizardConfig && !state.multiphaseState.isActive && onBuildCourse3Pass && noneBuilt && (
          <button
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            onClick={onBuildCourse3Pass}
            disabled={state.aiGenerating || state.isSaving}
          >
            {state.aiGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {t.buildCourse}
          </button>
        )}

        {/* Save */}
        <button
          className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          onClick={onSave}
          disabled={state.isSaving || !state.isDirty}
          title={t.saveDraft}
          aria-label={t.saveDraft}
        >
          {state.isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </button>

        {/* Translate */}
        {hasUntranslated && !state.multiphaseState.isActive && (
          <button
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent shadow-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
            onClick={handleTranslate}
            disabled={isTranslating || state.aiGenerating || state.isSaving}
          >
            {isTranslating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {translateProgress || t.translating}
              </>
            ) : (
              <>
                <Languages className="h-3.5 w-3.5" />
                {t.translate}
              </>
            )}
          </button>
        )}

        {/* Publish */}
        <button
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-medium bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          onClick={handlePublish}
          disabled={state.isSaving || isTranslating || state.aiGenerating || (state.status === 'published' && !state.hasUnpublishedChanges)}
        >
          {state.status === 'published' && state.hasUnpublishedChanges ? t.republish : t.publish}
        </button>
      </div>

      {/* Pre-publish translation dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="h-5 w-5" />
              {t.publishDialogTitle}
            </DialogTitle>
            <DialogDescription>
              {t.publishDialogDesc(untranslatedCount, totalSections)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowPublishDialog(false);
                void publish();
              }}
            >
              {t.publishEnOnly}
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={handleTranslateAndPublish}
            >
              <Languages className="h-3.5 w-3.5 mr-1" />
              {t.translateAndPublish}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
