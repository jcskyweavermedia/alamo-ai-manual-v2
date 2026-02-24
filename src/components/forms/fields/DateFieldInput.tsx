// =============================================================================
// DateFieldInput — Native <input type="date"> for best mobile UX
// =============================================================================

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface DateFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function DateFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: DateFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <Input
      id={fieldId}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(error && 'border-destructive focus-visible:ring-destructive')}
    />
  );
}
