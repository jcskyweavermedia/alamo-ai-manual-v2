/**
 * AuthLoadingScreen
 * 
 * Full-screen loading indicator shown during auth state transitions.
 * Per docs/plans/step-3-authentication-roles.md Phase 3.
 */

import { Loader2 } from 'lucide-react';

// =============================================================================
// COMPONENT
// =============================================================================

const STRINGS = {
  en: { loading: 'Loading...' },
  es: { loading: 'Cargando...' },
} as const;

interface AuthLoadingScreenProps {
  /** Loading message to display */
  message?: string;
  /** Language for default strings (default: 'en') */
  language?: 'en' | 'es';
}

export function AuthLoadingScreen({
  message,
  language = 'en',
}: AuthLoadingScreenProps) {
  const resolvedMessage = message ?? STRINGS[language].loading;
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-md">
        {/* Spinner */}
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        
        {/* Message */}
        <p className="text-body text-muted-foreground animate-pulse">
          {resolvedMessage}
        </p>
      </div>
    </div>
  );
}
