/**
 * ExtractedFieldRow
 *
 * Read-only field row inside the ExtractedFieldsCard.
 * Green check icon + field label + value preview.
 * Displayed after fields have been auto-applied to the form.
 */

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractedFieldRowProps {
  fieldKey: string;
  label: string;
  value: unknown;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    // ContactLookupValue or other complex values
    const obj = value as Record<string, unknown>;
    if (obj.name) return String(obj.name);
    return JSON.stringify(value);
  }
  return String(value);
}

export function ExtractedFieldRow({
  fieldKey: _fieldKey,
  label,
  value,
}: ExtractedFieldRowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 w-full',
        'px-2.5 py-2 rounded-lg',
      )}
    >
      {/* Green check icon (always shown -- field is already applied) */}
      <CheckCircle2 className="h-4.5 w-4.5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" />

      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground truncate">
          {formatValue(value)}
        </p>
      </div>
    </div>
  );
}
