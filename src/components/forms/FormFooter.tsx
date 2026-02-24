import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FormFooterProps } from '@/types/forms';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    saveDraft: 'Save Draft',
    submit: 'Submit',
    saving: 'Saving...',
    submitting: 'Submitting...',
  },
  es: {
    saveDraft: 'Guardar Borrador',
    submit: 'Enviar',
    saving: 'Guardando...',
    submitting: 'Enviando...',
  },
} as const;

/**
 * Sticky footer for form detail page.
 * Contains Save Draft (outline) and Submit (primary) buttons.
 * On mobile, sticks above MobileTabBar at bottom-[72px].
 */
export function FormFooter({
  isDirty,
  isSaving,
  isSubmitting,
  canSubmit,
  onSaveDraft,
  onSubmit,
  language,
}: FormFooterProps) {
  const t = STRINGS[language];

  return (
    <div
      className={cn(
        // Mobile: fixed above MobileTabBar
        'fixed bottom-[72px] left-0 right-0 z-20',
        'md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto',
        // Shared styles
        'flex gap-3 px-4 py-3',
        'bg-background/95 backdrop-blur-md',
        'border-t border-border',
        'shadow-[0_-1px_3px_rgba(0,0,0,0.05)]',
        'md:px-0 md:border-t-0 md:bg-transparent md:backdrop-blur-none md:shadow-none',
        'md:pt-4',
      )}
    >
      {/* Save Draft — ghost on mobile, outline on desktop */}
      <Button
        type="button"
        variant="ghost"
        className="flex-1 h-11 md:border md:border-input md:hover:bg-accent"
        disabled={!isDirty || isSaving || isSubmitting}
        onClick={onSaveDraft}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t.saving}
          </>
        ) : (
          t.saveDraft
        )}
      </Button>

      {/* Submit — primary with semibold */}
      <Button
        type="button"
        variant="default"
        className="flex-1 h-11 font-semibold"
        disabled={!canSubmit || isSaving || isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            {t.submitting}
          </>
        ) : (
          t.submit
        )}
      </Button>
    </div>
  );
}
