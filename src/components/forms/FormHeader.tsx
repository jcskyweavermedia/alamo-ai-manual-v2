import { ArrowLeft, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormTemplate } from '@/types/forms';

interface FormHeaderProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isSaving: boolean;
  lastSavedAt: Date | null;
  onBack: () => void;
}

/**
 * Sticky header for the form detail/fill page.
 * Back button (orange pill), icon + title (truncated), save indicator.
 * Bottom border for visual separation from the progress bar and body.
 */
export function FormHeader({
  template,
  language,
  isSaving,
  lastSavedAt,
  onBack,
}: FormHeaderProps) {
  const title = language === 'es' && template.titleEs ? template.titleEs : template.titleEn;

  return (
    <div
      className={cn(
        'sticky top-0 z-20',
        'flex items-center gap-3',
        'py-3 pb-3',
        'bg-background/95 backdrop-blur-md',
        'border-b border-border/40 dark:border-border/30',
      )}
    >
      {/* Back button — orange pill, matches RecipeCardView */}
      <button
        type="button"
        onClick={onBack}
        className={cn(
          'flex items-center justify-center shrink-0',
          'h-10 w-10 rounded-lg',
          'bg-orange-500 text-white',
          'hover:bg-slate-800 dark:hover:bg-slate-500 active:bg-slate-900',
          'shadow-sm transition-colors duration-150',
        )}
        aria-label={language === 'es' ? 'Volver a formularios' : 'Back to forms'}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      {/* Title — truncated */}
      <h1 className="flex-1 min-w-0 text-lg font-semibold text-foreground truncate">
        {title}
      </h1>

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
