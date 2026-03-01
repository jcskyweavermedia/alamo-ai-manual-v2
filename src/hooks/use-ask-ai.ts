/**
 * useAskAI Hook
 * 
 * Client-side integration with the /ask edge function.
 * Handles authentication, language, and error states.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import type { FormSuggestion } from '@/types/forms';

// =============================================================================
// TYPES
// =============================================================================

export interface Citation {
  id: string;
  slug: string;
  title: string;
}

export interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  usage: UsageInfo;
  sessionId?: string;
  mode?: 'action' | 'search' | 'form_navigation';
  formSuggestions?: FormSuggestion[];
  prefillContext?: string;
}

export interface AskError {
  error: string;
  message?: string;
  usage?: UsageInfo;
}

export interface AskOptions {
  expand?: boolean;
  context?: {
    sectionId?: string;
    sectionTitle?: string;
  };
  /** Product domain (dishes, wines, cocktails, recipes, beer_liquor) */
  domain?: string;
  /** Action key (e.g. samplePitch, teachMe) — omit for freeform search */
  action?: string;
  /** Full item data for product context */
  itemContext?: Record<string, unknown>;
  /** Chat session ID for conversation continuity */
  sessionId?: string;
}

export interface UseAskAIReturn {
  /** Send a question to the AI assistant */
  ask: (question: string, options?: AskOptions) => Promise<AskResult | null>;
  /** Whether a request is in progress */
  isLoading: boolean;
  /** Error message from the last request */
  error: string | null;
  /** Clear the current error */
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAskAI(): UseAskAIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  // Get the first group membership (primary group)
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const ask = useCallback(async (question: string, options?: AskOptions): Promise<AskResult | null> => {
    // Validate prerequisites
    if (!user) {
      const message = language === 'es' 
        ? 'Por favor inicia sesión para usar el asistente AI'
        : 'Please sign in to use the AI assistant';
      toast.error(message);
      return null;
    }

    if (!primaryGroup) {
      const message = language === 'es'
        ? 'No tienes acceso a ningún grupo'
        : 'You don\'t have access to any group';
      toast.error(message);
      return null;
    }

    // Check if AI is enabled for this role
    if (primaryGroup.policy && !primaryGroup.policy.canUseAi) {
      const message = language === 'es'
        ? 'El asistente AI no está disponible para tu rol'
        : 'AI assistant is not available for your role';
      toast.error(message);
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        question,
        language,
        groupId: primaryGroup.groupId,
        expand: options?.expand ?? false,
        context: options?.context ?? null,
      };

      // Product AI fields (optional)
      if (options?.domain) body.domain = options.domain;
      if (options?.action) body.action = options.action;
      if (options?.itemContext) body.itemContext = options.itemContext;
      if (options?.sessionId) body.sessionId = options.sessionId;

      const { data, error: fnError } = await supabase.functions.invoke('ask', {
        body,
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to call AI assistant');
      }

      // Handle error responses from the edge function
      if (data?.error) {
        const errorData = data as AskError;
        
        if (errorData.error === 'limit_exceeded') {
          const message = errorData.message || (language === 'es'
            ? 'Límite de preguntas alcanzado'
            : 'Question limit reached');
          toast.error(message);
          setError(message);
          return null;
        }

        if (errorData.error === 'forbidden') {
          const message = errorData.message || (language === 'es'
            ? 'No tienes acceso a este grupo'
            : 'You don\'t have access to this group');
          toast.error(message);
          setError(message);
          return null;
        }

        throw new Error(errorData.message || errorData.error);
      }

      return data as AskResult;
    } catch (err) {
      const message = err instanceof Error 
        ? err.message 
        : (language === 'es' ? 'Error al obtener respuesta' : 'Failed to get answer');
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, primaryGroup, language]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { 
    ask, 
    isLoading, 
    error,
    clearError,
  };
}
