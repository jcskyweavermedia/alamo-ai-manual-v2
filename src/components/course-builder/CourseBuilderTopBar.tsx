// =============================================================================
// CourseBuilderTopBar — Top bar with title, save status, undo/redo, publish
// Follows the pattern of BuilderTopBar for Form Builder
// =============================================================================

import { ArrowLeft, Undo2, Redo2, Save, Loader2, Check, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';

const STRINGS = {
  en: {
    back: 'Back',
    saveDraft: 'Save Draft',
    publish: 'Publish',
    saved: 'Saved',
    saving: 'Saving...',
    unsaved: 'Unsaved changes',
    error: 'Save error',
    undo: 'Undo',
    redo: 'Redo',
    titlePlaceholder: 'Course title...',
    generateOutline: 'Generate Outline',
    buildAll: 'Build All Content',
  },
  es: {
    back: 'Volver',
    saveDraft: 'Guardar',
    publish: 'Publicar',
    saved: 'Guardado',
    saving: 'Guardando...',
    unsaved: 'Cambios sin guardar',
    error: 'Error al guardar',
    undo: 'Deshacer',
    redo: 'Rehacer',
    titlePlaceholder: 'Titulo del curso...',
    generateOutline: 'Generar Esquema',
    buildAll: 'Generar Todo el Contenido',
  },
};

interface CourseBuilderTopBarProps {
  language: 'en' | 'es';
  onSave?: () => void | Promise<void>;
  onGenerateOutline?: () => void | Promise<void>;
  onBuildAllContent?: () => void | Promise<void>;
}

export function CourseBuilderTopBar({ language, onSave, onGenerateOutline, onBuildAllContent }: CourseBuilderTopBarProps) {
  const t = STRINGS[language];
  const navigate = useNavigate();
  const { state, setTitleEn, canUndo, canRedo, undo, redo, publish } = useCourseBuilder();

  // Save status indicator
  const StatusIndicator = () => {
    switch (state.saveStatus) {
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t.saving}
          </span>
        );
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3 w-3" />
            {t.saved}
          </span>
        );
      case 'unsaved':
        return (
          <span className="flex items-center gap-1 text-xs text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t.unsaved}
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3" />
            {t.error}
          </span>
        );
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0">
      {/* Back */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => navigate('/admin/courses')}
        aria-label={t.back}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Editable title */}
      <Input
        value={state.titleEn}
        onChange={(e) => setTitleEn(e.target.value)}
        placeholder={t.titlePlaceholder}
        className="h-8 text-sm font-medium border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 max-w-[280px]"
      />

      {/* Save status */}
      <div className="hidden sm:flex items-center">
        <StatusIndicator />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Undo / Redo */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canUndo}
        onClick={undo}
        aria-label={t.undo}
      >
        <Undo2 className={cn('h-4 w-4', !canUndo && 'opacity-30')} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canRedo}
        onClick={redo}
        aria-label={t.redo}
      >
        <Redo2 className={cn('h-4 w-4', !canRedo && 'opacity-30')} />
      </Button>

      {/* Generate Outline — visible when draft + has wizard_config */}
      {state.status === 'draft' && state.wizardConfig && onGenerateOutline && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs hidden sm:flex"
          onClick={onGenerateOutline}
          disabled={state.aiGenerating || state.isSaving}
        >
          {state.aiGenerating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5 mr-1" />
          )}
          {t.generateOutline}
        </Button>
      )}

      {/* Build All Content — visible when course has outline elements */}
      {state.sections.length > 0 && state.sections.some(s => s.elements.some(e => e.status === 'outline')) && onBuildAllContent && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs hidden sm:flex"
          onClick={onBuildAllContent}
          disabled={state.aiGenerating || state.isSaving}
        >
          {state.aiGenerating ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1" />
          )}
          {t.buildAll}
        </Button>
      )}

      {/* Save Draft */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={onSave}
        disabled={state.isSaving || !state.isDirty}
      >
        <Save className="h-3.5 w-3.5 mr-1" />
        {t.saveDraft}
      </Button>

      {/* Publish */}
      <Button
        size="sm"
        className="h-8 text-xs"
        onClick={publish}
        disabled={state.isSaving || state.status === 'published'}
      >
        {t.publish}
      </Button>
    </div>
  );
}
