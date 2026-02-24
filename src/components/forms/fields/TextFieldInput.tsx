// =============================================================================
// TextFieldInput — Thin wrapper around shadcn Input for text fields
// =============================================================================

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface TextFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function TextFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: TextFieldInputProps) {
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <Input
      id={fieldId}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      disabled={disabled}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(error && 'border-destructive focus-visible:ring-destructive')}
    />
  );
}
