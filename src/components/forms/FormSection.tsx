import { cn } from '@/lib/utils';
import { getSectionLabel, isFieldVisible } from '@/lib/form-utils';
import { getSectionEmoji } from '@/lib/section-emoji';
import type {
  FormSectionGroup,
  FormFieldValues,
  FormFieldValue,
} from '@/types/forms';

interface FormSectionProps {
  section: FormSectionGroup;
  values: FormFieldValues;
  errors: Record<string, string>;
  language: 'en' | 'es';
  onFieldChange: (key: string, value: FormFieldValue) => void;
  /** Render function for each field — injected by FormBody to avoid circular deps */
  renderField: (
    fieldKey: string,
    value: FormFieldValue,
    error: string | undefined,
    onChange: (value: FormFieldValue) => void,
  ) => React.ReactNode;
}

/**
 * Single section within a form: emoji tile + section header + card with child fields.
 * Header fields act as section dividers with auto-assigned contextual emojis.
 * Conditional visibility is evaluated here per field.
 */
export function FormSection({
  section,
  values,
  errors,
  language,
  onFieldChange,
  renderField,
}: FormSectionProps) {
  const label = getSectionLabel(section, language);
  const emojiInfo = getSectionEmoji(section.headerKey, section.label);

  return (
    <div>
      {/* ----------------------------------------------------------------
          Section header — emoji tile + bold uppercase label
      ---------------------------------------------------------------- */}
      {label && (
        <div className="flex items-center gap-3 mb-3">
          {/* Emoji tile — 36x36, white/card bg, subtle border + shadow */}
          <div
            className={cn(
              'flex items-center justify-center shrink-0',
              'w-9 h-9 rounded-[10px]',
              emojiInfo.bg,
              emojiInfo.darkBg,
              'border border-black/[0.04] dark:border-white/[0.06]',
              'shadow-sm',
            )}
          >
            <span className="text-[18px] h-[18px] leading-[18px]">
              {emojiInfo.emoji}
            </span>
          </div>

          {/* Section title */}
          <h2
            className={cn(
              'text-[13px] font-bold uppercase tracking-wider',
              'text-foreground/70 dark:text-foreground/60',
              'whitespace-nowrap',
            )}
          >
            {label}
          </h2>

          {/* Hairline rule — fills remaining space */}
          <div className="flex-1 border-t border-border/30 dark:border-border/20" />
        </div>
      )}

      {/* ----------------------------------------------------------------
          Section card — fields wrapped in a card container
      ---------------------------------------------------------------- */}
      <div
        className={cn(
          'bg-card rounded-[20px]',
          'border border-black/[0.04] dark:border-white/[0.06]',
          'shadow-card',
          'px-5 py-5',
        )}
      >
        {/* Fields — CSS grid for 2-column support on tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          {section.fields.map((field) => {
            // Evaluate conditional visibility
            if (!isFieldVisible(field, values)) return null;

            const fieldValue = values[field.key] ?? null;
            const fieldError = errors[field.key];
            const isHalf = field.width === 'half';

            return (
              <div key={field.key} className={isHalf ? '' : 'sm:col-span-2'}>
                {renderField(
                  field.key,
                  fieldValue,
                  fieldError,
                  (newValue) => onFieldChange(field.key, newValue),
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
