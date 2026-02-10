/**
 * useAskProduct Hook
 *
 * Client-side integration with the /ask-product edge function.
 * Handles authentication, language, group, loading/error/result states.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type ProductDomain = 'dishes' | 'wines' | 'cocktails' | 'recipes' | 'beer_liquor';

export interface ProductCitation {
  id: string;
  slug: string;
  name: string;
  domain: ProductDomain;
}

export interface UsageInfo {
  daily: { used: number; limit: number };
  monthly: { used: number; limit: number };
}

export interface AskProductResult {
  answer: string;
  citations: ProductCitation[];
  usage: UsageInfo;
  mode: 'action' | 'search';
}

export interface AskProductActionOptions {
  action: string;
  itemContext: Record<string, unknown>;
}

export interface AskProductOptions {
  domain: ProductDomain;
  actionOptions?: AskProductActionOptions;
}

export interface UseAskProductReturn {
  askProduct: (question: string, options: AskProductOptions) => Promise<AskProductResult | null>;
  isLoading: boolean;
  result: AskProductResult | null;
  error: string | null;
  clearResult: () => void;
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAskProduct(): UseAskProductReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AskProductResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const askProduct = useCallback(async (
    question: string,
    options: AskProductOptions,
  ): Promise<AskProductResult | null> => {
    // --- Validate prerequisites (same as useAskAI) ---
    if (!user) {
      const msg = language === 'es'
        ? 'Por favor inicia sesión para usar el asistente AI'
        : 'Please sign in to use the AI assistant';
      toast.error(msg);
      return null;
    }

    if (!primaryGroup) {
      const msg = language === 'es'
        ? 'No tienes acceso a ningún grupo'
        : "You don't have access to any group";
      toast.error(msg);
      return null;
    }

    if (primaryGroup.policy && !primaryGroup.policy.canUseAi) {
      const msg = language === 'es'
        ? 'El asistente AI no está disponible para tu rol'
        : 'AI assistant is not available for your role';
      toast.error(msg);
      return null;
    }

    // --- Call edge function ---
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {
        question,
        domain: options.domain,
        language,
        groupId: primaryGroup.groupId,
      };

      // Action mode: add action + itemContext
      if (options.actionOptions) {
        body.action = options.actionOptions.action;
        body.itemContext = options.actionOptions.itemContext;
      }

      const { data, error: fnError } = await supabase.functions.invoke('ask-product', { body });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to call product AI');
      }

      // Handle error responses from the edge function
      if (data?.error) {
        if (data.error === 'limit_exceeded') {
          const msg = data.message || (language === 'es'
            ? 'Límite de preguntas alcanzado'
            : 'Question limit reached');
          toast.error(msg);
          setError(msg);
          return null;
        }
        if (data.error === 'forbidden') {
          const msg = data.message || (language === 'es'
            ? 'No tienes acceso a este grupo'
            : "You don't have access to this group");
          toast.error(msg);
          setError(msg);
          return null;
        }
        throw new Error(data.message || data.error);
      }

      const askResult = data as AskProductResult;
      setResult(askResult);
      return askResult;
    } catch (err) {
      const msg = err instanceof Error
        ? err.message
        : (language === 'es' ? 'Error al obtener respuesta' : 'Failed to get answer');
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, primaryGroup, language]);

  const clearResult = useCallback(() => setResult(null), []);
  const clearError = useCallback(() => setError(null), []);

  return { askProduct, isLoading, result, error, clearResult, clearError };
}
