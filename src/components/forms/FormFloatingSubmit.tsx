/**
 * FormFloatingSubmit
 *
 * Minimal floating submit button that appears only on desktop
 * when the AI panel is docked open (which hides FormToolbar).
 * Positioned sticky at the bottom of the form scroll container.
 */

import { Loader2, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFloatingSubmitProps {
  language: 'en' | 'es';
  isSubmitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  isDirty: boolean;
  isSaving: boolean;
  onSaveDraft: () => void;
}

const STRINGS = {
  en: { submit: 'Submit', saveDraft: 'Save Draft' },
  es: { submit: 'Enviar', saveDraft: 'Guardar' },
} as const;

export function FormFloatingSubmit({
  language,
  isSubmitting,
  canSubmit,
  onSubmit,
  isDirty,
  isSaving,
  onSaveDraft,
}: FormFloatingSubmitProps) {
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
        'sticky bottom-4 z-[25]',
        'flex justify-center',
        'pointer-events-none',
        'animate-in fade-in slide-in-from-bottom-2 duration-200',
        'print:hidden',
      )}
    >
      <div
        className={cn(
          'pointer-events-auto',
          'bg-muted/90 backdrop-blur-md rounded-2xl',
          'shadow-[0_2px_16px_rgba(0,0,0,0.15)]',
          'px-3 py-2',
          'flex items-center gap-2',
        )}
      >
        {/* Save Draft */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!isDirty || isSaving || isSubmitting}
          className={cn(
            'h-9 px-3 rounded-lg shrink-0',
            'bg-muted text-foreground font-semibold text-sm',
            'inline-flex items-center justify-center gap-1.5',
            'transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {saveIcon}
          {t.saveDraft}
        </button>

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            'h-9 px-5 rounded-lg',
            'bg-primary text-primary-foreground font-semibold text-sm',
            'inline-flex items-center justify-center gap-1.5',
            'transition-colors',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.submit}
        </button>
      </div>
    </div>
  );
}
