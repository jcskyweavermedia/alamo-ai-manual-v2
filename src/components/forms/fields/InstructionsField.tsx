// =============================================================================
// InstructionsField — Read-only callout / info card
// bg-blue-50 / dark variant. Info icon + text. No input, no value.
// =============================================================================

import { Info } from 'lucide-react';
import { getFieldLabel } from '@/lib/form-utils';
import type { FormFieldDefinition } from '@/types/forms';

interface InstructionsFieldProps {
  field: FormFieldDefinition;
  language: 'en' | 'es';
}

export function InstructionsField({
  field,
  language,
}: InstructionsFieldProps) {
  const label = getFieldLabel(field, language);
  const hint = language === 'es' && field.hint_es ? field.hint_es : field.hint;

  return (
    <div
      role="note"
      className="flex gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50"
    >
      <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <div className="space-y-1.5 min-w-0">
        {label && (
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 leading-snug">
            {label}
          </p>
        )}
        {hint && (
          <div className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed whitespace-pre-line">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
