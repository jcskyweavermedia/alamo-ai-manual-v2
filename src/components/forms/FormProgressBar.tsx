import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { countFillableFields, countFilledFields, isFieldVisible } from '@/lib/form-utils';
import type { FormFieldDefinition, FormFieldValues } from '@/types/forms';

interface FormProgressBarProps {
  fields: FormFieldDefinition[];
  values: FormFieldValues;
}

/**
 * Progress bar showing how many fillable fields have been completed.
 * Displays percentage + "X of Y" label.
 * Only counts visible fields (respects conditional visibility).
 */
export function FormProgressBar({ fields, values }: FormProgressBarProps) {
  // Filter to only visible fields before counting
  const visibleFields = useMemo(
    () => fields.filter((f) => isFieldVisible(f, values)),
    [fields, values],
  );
  const total = useMemo(() => countFillableFields(visibleFields), [visibleFields]);
  const filled = useMemo(() => countFilledFields(visibleFields, values), [visibleFields, values]);

  const percent = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="space-y-1.5">
      {/* Label row — percentage left, count right */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums text-foreground/60 dark:text-foreground/50">
          {percent}%
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {filled} / {total}
        </span>
      </div>
      {/* Bar — 6px tall, rounded, primary color */}
      <Progress value={percent} className="h-1.5 flex-1" />
    </div>
  );
}
