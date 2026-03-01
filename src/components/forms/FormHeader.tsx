import { Loader2, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormTemplate } from '@/types/forms';

interface FormHeaderProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isSaving: boolean;
  lastSavedAt: Date | null;
  onClear?: () => void;
  clearDisabled?: boolean;
}

/**
 * Sticky header for the form detail/fill page.
 * Title (truncated), clear-form button, save indicator.
 * Bottom border for visual separation from the progress bar and body.
 */
export function FormHeader({
  template,
  language,
  isSaving,
  lastSavedAt,
  onClear,
  clearDisabled = false,
}: FormHeaderProps) {
  const title = language === 'es' && template.titleEs ? template.titleEs : template.titleEn;

  return (
    <div
      className={cn(
        'sticky top-0 z-30',
        'flex items-center gap-3',
        'py-3',
        'bg-background',
        'border-b border-border/40 dark:border-border/30',
        'shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]',
      )}
    >
      {/* Title — truncated */}
      <h1 className="flex-1 min-w-0 text-lg font-semibold text-foreground truncate">
        {title}
      </h1>

      {/* Clear form button */}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          className={cn(
            'flex items-center justify-center shrink-0',
            'h-8 w-8 rounded-lg',
            'text-muted-foreground',
            'hover:text-foreground hover:bg-muted',
            'transition-colors duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
          aria-label={language === 'es' ? 'Limpiar Formulario' : 'Clear Form'}
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      )}

      {/* Save indicator */}
      <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
        {isSaving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{language === 'es' ? 'Guardando...' : 'Saving...'}</span>
          </>
        ) : lastSavedAt ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span>
              {language === 'es' ? 'Guardado' : 'Saved'}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
