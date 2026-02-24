// =============================================================================
// CheckboxFieldInput — One Checkbox per option
// value: string[], onChange: (v: string[]) => void
// >6 options = 2-column grid, 44px rows
// =============================================================================

import { useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface CheckboxFieldInputProps {
  field: FormFieldDefinition;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export function CheckboxFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: CheckboxFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const options = field.options ?? [];
  const useTwoColumns = options.length > 6;

  const handleToggle = useCallback(
    (option: string, checked: boolean) => {
      if (checked) {
        onChange([...value, option]);
      } else {
        onChange(value.filter((v) => v !== option));
      }
    },
    [value, onChange]
  );

  return (
    <div
      role="group"
      aria-labelledby={`${fieldId}-label`}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        'grid gap-1',
        useTwoColumns ? 'grid-cols-2' : 'grid-cols-1'
      )}
    >
      {options.map((option) => {
        const optionId = `${fieldId}-${option.replace(/\s+/g, '-').toLowerCase()}`;
        const isChecked = value.includes(option);

        return (
          <div
            key={option}
            className="flex items-center gap-3 h-11"
          >
            <Checkbox
              id={optionId}
              checked={isChecked}
              onCheckedChange={(checked) =>
                handleToggle(option, checked === true)
              }
              disabled={disabled}
            />
            <Label
              htmlFor={optionId}
              className="text-sm font-normal cursor-pointer leading-none"
            >
              {option}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
