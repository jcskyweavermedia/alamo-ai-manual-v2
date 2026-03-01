/**
 * ExtractedFieldsCard
 *
 * Read-only confirmation card shown after AI auto-applies fields.
 * Contains:
 * - Header: "N fields filled" with sparkle icon
 * - Read-only list of ExtractedFieldRow components
 * - Missing fields callout (amber warning)
 * - Tool result chips
 */

import { useMemo } from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExtractedFieldRow } from './ExtractedFieldRow';
import { ToolResultChip } from './ToolResultChip';
import type { FormTemplate } from '@/types/forms';
import type { AskFormResult } from '@/hooks/use-ask-form';

interface ExtractedFieldsCardProps {
  result: AskFormResult;
  template: FormTemplate | undefined;
  language: 'en' | 'es';
}

const STRINGS = {
  en: {
    fieldsFilled: (n: number) => `${n} field${n === 1 ? '' : 's'} filled`,
    missingFields: (n: number) => `${n} required field${n === 1 ? '' : 's'} still needed`,
  },
  es: {
    fieldsFilled: (n: number) => `${n} campo${n === 1 ? '' : 's'} completado${n === 1 ? '' : 's'}`,
    missingFields: (n: number) => `${n} campo${n === 1 ? '' : 's'} requerido${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'}`,
  },
} as const;

export function ExtractedFieldsCard({
  result,
  template,
  language,
}: ExtractedFieldsCardProps) {
  const t = STRINGS[language];
  const fieldKeys = Object.keys(result.fieldUpdates);

  // Build a map from field key -> label for display
  const fieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    if (template) {
      for (const field of template.fields) {
        const label = language === 'es' && field.label_es ? field.label_es : field.label;
        map.set(field.key, label);
      }
    }
    return map;
  }, [template, language]);

  if (fieldKeys.length === 0 && result.missingFields.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60',
        'bg-card shadow-sm',
        'overflow-hidden',
      )}
    >
      {/* Header */}
      {fieldKeys.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40 bg-green-500/5 dark:bg-green-500/10">
          <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            {t.fieldsFilled(fieldKeys.length)}
          </span>
        </div>
      )}

      {/* Read-only field rows */}
      {fieldKeys.length > 0 && (
        <div className="px-1 py-1">
          {fieldKeys.map((key) => (
            <ExtractedFieldRow
              key={key}
              fieldKey={key}
              label={fieldLabelMap.get(key) ?? key}
              value={result.fieldUpdates[key]}
            />
          ))}
        </div>
      )}

      {/* Tool results */}
      {result.toolResults.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-border/30">
          {result.toolResults.map((tr, i) => (
            <ToolResultChip
              key={i}
              tool={tr.tool}
              query={tr.query}
              resultCount={tr.resultCount}
              topResult={tr.topResult}
            />
          ))}
        </div>
      )}

      {/* Missing fields callout */}
      {result.missingFields.length > 0 && (
        <div
          className={cn(
            'flex items-start gap-2 px-3 py-2.5',
            'bg-warning/10 border-t border-warning/20',
          )}
        >
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning font-medium leading-relaxed">
            {t.missingFields(result.missingFields.length)}
          </p>
        </div>
      )}
    </div>
  );
}
