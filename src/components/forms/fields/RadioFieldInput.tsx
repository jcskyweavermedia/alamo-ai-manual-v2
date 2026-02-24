// =============================================================================
// RadioFieldInput — Radix RadioGroup
// Supports 3 layouts:
//   - variant="button": horizontal toggle buttons (pill style)
//   - 2 options: horizontal radio circles
//   - 3+ options: vertical radio circles
// 44px row height for touch targets
// =============================================================================

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface RadioFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function RadioFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: RadioFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const options = field.options ?? [];

  // Button variant — horizontal toggle group
  if (field.variant === 'button') {
    return (
      <div
        role="radiogroup"
        aria-required={field.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="flex flex-wrap gap-1.5 sm:gap-2"
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
                'px-3 py-2 sm:px-4 rounded-full',
                'text-xs sm:text-sm font-medium',
                'border transition-all duration-150',
                'min-h-[40px] sm:min-h-[44px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground',
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

  // Standard radio layout
  const isHorizontal = options.length <= 2;

  return (
    <RadioGroup
      id={fieldId}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        isHorizontal ? 'flex flex-row gap-4' : 'flex flex-col gap-1'
      )}
    >
      {options.map((option) => {
        const optionId = `${fieldId}-${option.replace(/\s+/g, '-').toLowerCase()}`;
        return (
          <div
            key={option}
            className="flex items-center gap-3 h-11"
          >
            <RadioGroupItem value={option} id={optionId} />
            <Label
              htmlFor={optionId}
              className="text-sm font-normal cursor-pointer leading-none"
            >
              {option}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
