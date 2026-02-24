// =============================================================================
// SelectFieldInput — Radix Select with field.options mapped to SelectItem
// 44px trigger height, portal dropdown
// =============================================================================

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface SelectFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function SelectFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: SelectFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const options = field.options ?? [];

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={fieldId}
        aria-required={field.required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'h-11',
          error && 'border-destructive focus:ring-destructive'
        )}
      >
        <SelectValue placeholder={field.placeholder ?? 'Select...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="h-11">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
