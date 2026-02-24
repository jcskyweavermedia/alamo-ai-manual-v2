// =============================================================================
// PhoneFieldInput — Phone input with inputMode="tel" for phone keyboard
// =============================================================================

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface PhoneFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function PhoneFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: PhoneFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <Input
      id={fieldId}
      type="tel"
      inputMode="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder ?? '(555) 123-4567'}
      disabled={disabled}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(error && 'border-destructive focus-visible:ring-destructive')}
    />
  );
}
