/**
 * TranslationBanner
 * 
 * Shown when requested translation is not available.
 * Informs user they're seeing English fallback content.
 * Per docs/plans/step-4-search-mvp.md Phase 5.
 */

import { Globe } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TranslationBannerProps {
  /** User's selected language */
  language: 'en' | 'es';
  /** Whether the content is in the requested language (false = fallback to English) */
  isRequestedLanguage?: boolean;
}

export function TranslationBanner({ language, isRequestedLanguage = true }: TranslationBannerProps) {
  // Only show banner when user requested Spanish but got English fallback
  if (language !== 'es' || isRequestedLanguage) {
    return null;
  }

  return (
    <Alert className="border-warning/50 bg-warning/5">
      <Globe className="h-4 w-4 text-warning" />
      <AlertDescription className="text-foreground">
        Esta página aún no está disponible en español. Mostrando versión en inglés.
      </AlertDescription>
    </Alert>
  );
}
