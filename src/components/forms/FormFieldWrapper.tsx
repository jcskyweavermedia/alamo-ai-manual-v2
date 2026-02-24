// =============================================================================
// FormFieldWrapper — Label + required indicator + hint + error wrapper
// Wraps every field input with consistent layout and accessibility
// =============================================================================

import { Label } from '@/components/ui/label';
import { getFieldLabel } from '@/lib/form-utils';
import { cn } from '@/lib/utils';
import type { FormFieldWrapperProps } from '@/types/forms';

export function FormFieldWrapper({
  field,
  error,
  language,
  children,
}: FormFieldWrapperProps) {
  const label = getFieldLabel(field, language);
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  // Build aria-describedby from available descriptors
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-2">
      {/* Label with required indicator */}
      <Label
        htmlFor={fieldId}
        className={cn(
          'text-[13px] font-semibold leading-none tracking-tight',
          'text-foreground/80 dark:text-foreground/70',
          error && 'text-destructive dark:text-destructive'
        )}
      >
        {label}
        {field.required && (
          <>
            <span className="text-destructive ml-0.5" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </Label>

      {/* Field input — each field component independently sets id, aria-describedby, etc. */}
      <div data-field-id={fieldId}>
        {children}
      </div>

      {/* Hint text — shown below input when no error */}
      {field.hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground/80 leading-relaxed">
          {field.hint}
        </p>
      )}

      {/* Error text — replaces hint when present */}
      {error && (
        <p
          id={errorId}
          className="text-xs text-destructive font-semibold"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
