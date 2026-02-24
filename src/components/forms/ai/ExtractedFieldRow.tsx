/**
 * ExtractedFieldRow
 *
 * Single toggleable field row inside the ExtractedFieldsCard.
 * Checkbox indicator + field label + value preview.
 * Keyboard accessible via native button element.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractedFieldRowProps {
  fieldKey: string;
  label: string;
  value: unknown;
  checked: boolean;
  onToggle: (fieldKey: string) => void;
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
  fieldKey,
  label,
  value,
  checked,
  onToggle,
}: ExtractedFieldRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(fieldKey)}
      className={cn(
        'flex items-start gap-2.5 w-full text-left',
        'px-2.5 py-2 rounded-lg',
        'hover:bg-muted/50 active:bg-muted/70',
        'transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      )}
      aria-pressed={checked}
    >
      {/* Checkbox indicator */}
      <div
        className={cn(
          'flex items-center justify-center shrink-0',
          'w-5 h-5 mt-0.5 rounded',
          'border-2 transition-colors duration-100',
          checked
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/30 bg-transparent',
        )}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </div>

      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground truncate">
          {formatValue(value)}
        </p>
      </div>
    </button>
  );
}
