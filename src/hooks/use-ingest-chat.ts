/**
 * useIngestChat Hook
 *
 * Sends messages to the AI ingest edge function (two-call pipeline).
 * Every message returns both a conversational reply and a structured draft.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import type { PrepRecipeDraft, WineDraft, CocktailDraft, PlateSpecDraft } from '@/types/ingestion';

// =============================================================================
// TYPES
// =============================================================================

interface ChatResult {
  message: string;
  draft: PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft | null;
  sessionId: string;
  confidence?: number;
  missingFields?: string[];
}

export interface UseIngestChatReturn {
  /** Send a message to the pipeline (works for both first and follow-up messages) */
  sendMessage: (content: string, sessionId?: string) => Promise<ChatResult | null>;
  /** Whether a request is in progress */
  isProcessing: boolean;
  /** Error message from the last request */
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useIngestChat(productTable: string = 'prep_recipes', department?: string): UseIngestChatReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { language } = useLanguage();

  const sendMessage = useCallback(
    async (content: string, sessionId?: string): Promise<ChatResult | null> => {
      if (!user) {
        toast.error(
          language === 'es'
            ? 'Por favor inicia sesion para usar el asistente'
            : 'Please sign in to use the assistant',
        );
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'ingest',
          {
            body: {
              content,
              sessionId: sessionId ?? undefined,
              productTable,
              language,
              department,
            },
          },
        );

        if (fnError) {
          throw new Error(fnError.message || 'Failed to call ingest function');
        }

        if (data?.error) {
          throw new Error(data.message || data.error);
        }

        return {
          message: data.message as string,
          draft: (data.draft as PrepRecipeDraft | WineDraft | CocktailDraft | PlateSpecDraft) ?? null,
          sessionId: data.sessionId as string,
          confidence: data.confidence as number | undefined,
          missingFields: data.missingFields as string[] | undefined,
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : language === 'es'
              ? 'Error al enviar mensaje'
              : 'Failed to send message';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [user, language, productTable, department],
  );

  return {
    sendMessage,
    isProcessing,
    error,
  };
}
