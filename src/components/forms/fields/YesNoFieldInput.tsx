// =============================================================================
// YesNoFieldInput — Toggle/segmented control for binary Yes/No questions
// Renders as a horizontal segmented control with two options.
// Value is stored as "Yes" or "No" (string) for consistency with other fields.
// 44px min-height for touch targets.
// =============================================================================

import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface YesNoFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function YesNoFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: YesNoFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const options = field.options ?? ['Yes', 'No'];

  return (
    <div
      role="radiogroup"
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className="flex rounded-lg border border-input overflow-hidden"
    >
      {options.map((option) => {
        const isSelected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'flex-1 py-2.5 px-4',
              'text-sm font-medium',
              'min-h-[44px]',
              'transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              isSelected
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
