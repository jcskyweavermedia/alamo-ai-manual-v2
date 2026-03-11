import { Loader2, Check, RotateCcw, Trash2, Printer, Mail, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormTemplate } from '@/types/forms';

interface FormHeaderProps {
  template: FormTemplate;
  language: 'en' | 'es';
  isSaving: boolean;
  lastSavedAt: Date | null;
  onClear?: () => void;
  clearDisabled?: boolean;
  onDelete?: () => void;
  onSaveDraft?: () => void;
  isDirty?: boolean;
  onSubmit: () => void;
  onPrint: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  showEmailPlaceholder?: boolean;
}

const STRINGS = {
  en: { submit: 'Submit', comingSoon: 'Coming Soon' },
  es: { submit: 'Enviar', comingSoon: 'Proximamente' },
} as const;

/**
 * Sticky header for the form detail/fill page.
 * Title (truncated), action buttons (delete, clear, print, email, submit), save indicator.
 * Bottom border for visual separation from the progress bar and body.
 */
export function FormHeader({
  template,
  language,
  isSaving,
  lastSavedAt,
  onClear,
  clearDisabled = false,
  onDelete,
  onSaveDraft,
  isDirty = false,
  onSubmit,
  onPrint,
  isSubmitting,
  canSubmit,
  showEmailPlaceholder = false,
}: FormHeaderProps) {
  const title = language === 'es' && template.titleEs ? template.titleEs : template.titleEn;
  const t = STRINGS[language];

  const iconBtnClass = cn(
    'flex items-center justify-center shrink-0',
    'h-8 w-8 rounded-lg',
    'text-muted-foreground',
    'hover:text-foreground hover:bg-muted',
    'transition-colors duration-150',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  );

  return (
    <div
      className={cn(
        'sticky top-0 z-30',
        'flex items-center gap-2',
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

      {/* Action buttons — hidden during print */}
      <div className="flex items-center gap-1 shrink-0 print:hidden">
        {/* Delete draft (admin only) */}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={cn(
              iconBtnClass,
              'hover:text-destructive hover:bg-destructive/10',
            )}
            aria-label={language === 'es' ? 'Eliminar Borrador' : 'Delete Draft'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}

        {/* Clear form */}
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={clearDisabled}
            className={iconBtnClass}
            aria-label={language === 'es' ? 'Limpiar Formulario' : 'Clear Form'}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        {/* Save draft (disk icon) */}
        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={!isDirty || isSaving}
            className={iconBtnClass}
            aria-label={language === 'es' ? 'Guardar Borrador' : 'Save Draft'}
          >
            <Save className="h-4 w-4" />
          </button>
        )}

        {/* Print */}
        <button
          type="button"
          onClick={onPrint}
          className={iconBtnClass}
          aria-label={language === 'es' ? 'Imprimir' : 'Print'}
        >
          <Printer className="h-4 w-4" />
        </button>

        {/* Email (placeholder — disabled) */}
        {showEmailPlaceholder && (
          <button
            type="button"
            disabled
            className={cn(iconBtnClass, 'opacity-40 cursor-not-allowed')}
            title={t.comingSoon}
            aria-label={language === 'es' ? 'Correo Electronico' : 'Email'}
          >
            <Mail className="h-4 w-4" />
          </button>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || isSubmitting}
          className={cn(
            'h-7 px-3 rounded-lg shrink-0',
            'bg-orange-500 text-white font-semibold text-xs',
            'inline-flex items-center justify-center gap-1.5',
            'hover:bg-orange-600 active:scale-[0.97]',
            'transition-all duration-150',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t.submit}
        </button>
      </div>

      {/* Save indicator — hidden during print */}
      <div className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground print:hidden">
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
