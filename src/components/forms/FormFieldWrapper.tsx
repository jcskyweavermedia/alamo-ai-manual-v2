// =============================================================================
// FormFieldWrapper — Label + required indicator + hint + error wrapper
// Wraps every field input with consistent layout and accessibility
// Supports AI highlight glow and missing field badge from Phase 3
// =============================================================================

import { Label } from '@/components/ui/label';
import { getFieldLabel } from '@/lib/form-utils';
import { cn } from '@/lib/utils';
import { MissingFieldBadge } from '@/components/forms/ai/MissingFieldBadge';
import type { FormFieldWrapperProps } from '@/types/forms';

interface ExtendedFormFieldWrapperProps extends FormFieldWrapperProps {
  /** When true, field plays the AI fill highlight glow animation */
  aiHighlighted?: boolean;
  /** When true, shows an amber "Needed" badge (AI identified as missing) */
  aiMissing?: boolean;
  /** When true, hides the built-in label (for canvas mode where EditableLabel is used) */
  hideLabel?: boolean;
}

export function FormFieldWrapper({
  field,
  error,
  language,
  children,
  aiHighlighted,
  aiMissing,
  hideLabel,
}: ExtendedFormFieldWrapperProps) {
  const label = getFieldLabel(field, language);
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  // Build aria-describedby from available descriptors
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div
      className={cn(
        'space-y-2',
        aiHighlighted && 'ai-fill-highlight',
      )}
      data-field-id={fieldId}
    >
      {/* Label with required indicator + missing badge */}
      {!hideLabel && (
        <div className="flex items-center gap-1.5">
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
          {aiMissing && <MissingFieldBadge language={language} />}
        </div>
      )}

      {/* Field input */}
      <div>
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
