/**
 * FormToolbar
 *
 * Unified floating toolbar that replaces both FormFloatingMicBar and FormFooter.
 * Sits at the bottom of the form page, combining view-mode toggle,
 * save, submit, and voice controls into a single frosted-glass bar.
 *
 * Layout (left to right):
 *   [ Form | Chat ]   <spacer>   💾  [ Submit ]   <spacer>   ( MIC )
 *
 * Hidden on desktop when the docked AI panel is open (parent controls visibility).
 * Mobile: fixed above MobileTabBar (bottom-[72px])
 * Desktop: sticky inside scroll area (bottom-4, centered)
 */

import { Save, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormHeroMicButton } from './FormHeroMicButton';

// =============================================================================
// TYPES
// =============================================================================

interface FormToolbarProps {
  language: 'en' | 'es';
  // Voice
  isRecording: boolean;
  isTranscribing: boolean;
  audioLevel: number;
  elapsedSeconds: number;
  isWarning: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  // Mode toggle
  viewMode: 'form' | 'chat';
  onViewModeChange: (mode: 'form' | 'chat') => void;
  // Save/Submit
  isDirty: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: { submit: 'Submit', saveDraft: 'Save Draft' },
  es: { submit: 'Enviar', saveDraft: 'Guardar Borrador' },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function FormToolbar({
  language,
  // Voice
  isRecording,
  isTranscribing,
  audioLevel,
  elapsedSeconds,
  isWarning,
  onStartRecording,
  onStopRecording,
  // Mode toggle
  viewMode,
  onViewModeChange,
  // Save/Submit
  isDirty,
  isSaving,
  isSubmitting,
  canSubmit,
  onSaveDraft,
  onSubmit,
}: FormToolbarProps) {
  const t = STRINGS[language];

  // Determine save icon state
  const saveIcon = isSaving ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : !isDirty ? (
    <Check className="h-4 w-4 text-green-500" />
  ) : (
    <Save className="h-4 w-4" />
  );

  return (
    <div
      className={cn(
        // Mobile: fixed above MobileTabBar
        'fixed bottom-[72px] left-0 right-0 z-20',
        // Desktop: sticky inside scroll area, centered
        'md:sticky md:bottom-4 md:left-auto md:right-auto md:z-[25]',
        // Frosted glass pill
        'bg-muted/90 backdrop-blur-md rounded-2xl',
        'shadow-[0_2px_16px_rgba(0,0,0,0.15)]',
        // Spacing
        'mx-3 md:mx-0',
        'flex items-center gap-2 px-3 py-2',
      )}
    >
      {/* ---- FORM / CHAT TOGGLE ---- */}
      <div className="rounded-lg bg-background/60 p-0.5 flex shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange('form')}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150',
            viewMode === 'form'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('chat')}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150',
            viewMode === 'chat'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Chat
        </button>
      </div>

      {/* ---- LEFT SPACER (pushes save+submit to center) ---- */}
      <div className="flex-1" />

      {/* ---- SAVE ICON BUTTON ---- */}
      <button
        type="button"
        onClick={onSaveDraft}
        disabled={!isDirty || isSaving || isSubmitting}
        className={cn(
          'h-9 w-9 rounded-lg shrink-0',
          'inline-flex items-center justify-center',
          'text-muted-foreground hover:text-foreground hover:bg-muted',
          'transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
        aria-label={t.saveDraft}
      >
        {saveIcon}
      </button>

      {/* ---- SUBMIT BUTTON ---- */}
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit || isSaving || isSubmitting}
        className={cn(
          'h-9 px-4 rounded-lg shrink-0',
          'bg-primary text-primary-foreground font-semibold text-sm',
          'inline-flex items-center justify-center gap-1.5',
          'transition-colors',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.submit}
      </button>

      {/* ---- RIGHT SPACER (pushes mic to right) ---- */}
      <div className="flex-1" />

      {/* ---- MIC BUTTON (right side) ---- */}
      <FormHeroMicButton
        language={language}
        isRecording={isRecording}
        isTranscribing={isTranscribing}
        audioLevel={audioLevel}
        elapsedSeconds={elapsedSeconds}
        isWarning={isWarning}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        hasHistory={true}
      />
    </div>
  );
}
