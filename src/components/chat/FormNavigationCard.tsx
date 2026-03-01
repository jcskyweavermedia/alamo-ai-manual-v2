/**
 * FormNavigationCard
 *
 * Rendered in the chat area when the AI detects form intent and returns
 * formSuggestions. Displays a list of matching form templates with
 * "Fill this form" CTA buttons and a dismiss link.
 *
 * Bilingual (EN/ES). Visually consistent with AIAnswerCard (CardFloating).
 */

import { ArrowRight, ClipboardList, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardFloating } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { resolveIcon } from '@/lib/form-builder/icon-utils';
import type { FormSuggestion } from '@/types/forms';

// =============================================================================
// STRINGS
// =============================================================================

const STRINGS = {
  en: {
    header: 'I found these forms:',
    bestMatch: 'Best match',
    fillForm: 'Fill this form',
    dismiss: 'Not what I need',
  },
  es: {
    header: 'Encontre estos formularios:',
    bestMatch: 'Mejor resultado',
    fillForm: 'Llenar formulario',
    dismiss: 'No es lo que necesito',
  },
} as const;

// =============================================================================
// TYPES
// =============================================================================

interface FormNavigationCardProps {
  suggestions: FormSuggestion[];
  prefillContext: string;
  language: 'en' | 'es';
  onSelectForm: (slug: string, prefillContext: string) => void;
  onDismiss: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function FormNavigationCard({
  suggestions,
  prefillContext,
  language,
  onSelectForm,
  onDismiss,
}: FormNavigationCardProps) {
  const t = STRINGS[language];

  if (suggestions.length === 0) return null;

  return (
    <CardFloating className={cn('p-lg max-w-md w-full')}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-md">
        <ClipboardList className="h-5 w-5 text-primary shrink-0" />
        <span className="text-body font-semibold text-foreground">
          {t.header}
        </span>
      </div>

      {/* Suggestion list */}
      <div className="space-y-sm">
        {suggestions.map((suggestion, index) => {
          const iconConfig = resolveIcon(suggestion.icon, suggestion.iconColor);
          const isBestMatch = index === 0;

          return (
            <div
              key={suggestion.slug}
              className={cn(
                'flex items-start gap-3 p-3',
                'rounded-xl border',
                'border-border/60 dark:border-border/40',
                'bg-muted/30 dark:bg-muted/15',
                'transition-colors duration-150',
                'hover:bg-muted/50 dark:hover:bg-muted/25',
              )}
            >
              {/* Icon tile */}
              <div
                className={cn(
                  'flex items-center justify-center shrink-0',
                  'w-10 h-10 rounded-[10px]',
                  iconConfig.bg,
                  iconConfig.darkBg,
                )}
              >
                <span className="text-[20px] h-[20px] leading-[20px]">
                  {iconConfig.emoji}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-foreground leading-tight">
                    {suggestion.title}
                  </h4>
                  {isBestMatch && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        'px-2 py-0.5 rounded-full',
                        'text-[10px] font-medium leading-none',
                        'bg-primary/10 text-primary',
                        'dark:bg-primary/20',
                      )}
                    >
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {t.bestMatch}
                    </span>
                  )}
                </div>
                {suggestion.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {suggestion.description}
                  </p>
                )}

                {/* CTA button */}
                <Button
                  variant={isBestMatch ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'mt-2 h-7 rounded-full text-xs px-3',
                    isBestMatch && 'shadow-sm',
                  )}
                  onClick={() => onSelectForm(suggestion.slug, prefillContext)}
                >
                  {t.fillForm}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dismiss link */}
      <div className="mt-md pt-sm">
        <button
          type="button"
          onClick={onDismiss}
          className={cn(
            'text-small text-muted-foreground',
            'hover:text-foreground',
            'underline underline-offset-2',
            'transition-colors duration-150',
          )}
        >
          {t.dismiss}
        </button>
      </div>
    </CardFloating>
  );
}
