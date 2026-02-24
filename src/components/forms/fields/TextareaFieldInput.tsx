// =============================================================================
// TextareaFieldInput — Auto-expanding textarea
// min-h-[88px], max-h-[240px], resize-none
// =============================================================================

import { useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { FormFieldDefinition } from '@/types/forms';

interface TextareaFieldInputProps {
  field: FormFieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}

export function TextareaFieldInput({
  field,
  value,
  onChange,
  disabled,
  error,
}: TextareaFieldInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = `field-${field.key}`;
  const hintId = field.hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);

      // Auto-expand: reset height then set to scrollHeight (capped by max-h)
      const el = e.target;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    },
    [onChange]
  );

  return (
    <Textarea
      ref={textareaRef}
      id={fieldId}
      value={value}
      onChange={handleChange}
      placeholder={field.placeholder}
      disabled={disabled}
      aria-required={field.required || undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={cn(
        'min-h-[88px] max-h-[240px] resize-none',
        error && 'border-destructive focus-visible:ring-destructive'
      )}
    />
  );
}
