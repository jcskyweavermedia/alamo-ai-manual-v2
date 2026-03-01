/**
 * useAskForm Hook
 *
 * Client-side integration with the /ask-form edge function.
 * Manages conversation history, session ID, loading/error/result states.
 * Follows the pattern of use-ask-product.ts with multi-turn additions.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';
import type { FormTemplate, FormFieldValues, FormFieldValue } from '@/types/forms';

// =============================================================================
// TYPES
// =============================================================================

export interface AttachmentInput {
  type: 'image' | 'file';
  name: string;
  mimeType: string;
  content: string; // base64 data URL for images, text content for files
}

export interface AskFormResult {
  fieldUpdates: Record<string, FormFieldValue>;
  missingFields: string[];
  followUpQuestion: string | null;
  message: string;
  toolResults: Array<{
    tool: string;
    query: string;
    resultCount: number;
    topResult?: string;
  }>;
  citations: Array<{
    source: string;
    title: string;
    snippet: string;
  }>;
  usage: {
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  };
  sessionId: string;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  result?: AskFormResult;
  attachments?: Array<{ name: string; type: string; previewUrl?: string }>;
  timestamp: number;
}

export interface UseAskFormOptions {
  template: FormTemplate | undefined;
  currentValues: FormFieldValues;
}

export interface UseAskFormReturn {
  askForm: (
    question: string,
    options?: { attachments?: AttachmentInput[] },
  ) => Promise<AskFormResult | null>;
  clearConversation: () => void;
  isLoading: boolean;
  result: AskFormResult | null;
  error: string | null;
  conversationHistory: ConversationTurn[];
  sessionId: string | null;
  totalFieldsUpdated: number;
  hasFollowUp: boolean;
}

// =============================================================================
// UUID v4 GENERATOR (crypto-based)
// =============================================================================

function generateUUID(): string {
  return crypto.randomUUID();
}

// =============================================================================
// HOOK
// =============================================================================

export function useAskForm({
  template,
  currentValues,
}: UseAskFormOptions): UseAskFormReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AskFormResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const totalFieldsUpdatedRef = useRef(0);

  const { user, permissions } = useAuth();
  const { language } = useLanguage();

  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const askForm = useCallback(
    async (
      question: string,
      options?: { attachments?: AttachmentInput[] },
    ): Promise<AskFormResult | null> => {
      // --- Validate prerequisites ---
      if (!user) {
        const msg =
          language === 'es'
            ? 'Por favor inicia sesion para usar el asistente AI'
            : 'Please sign in to use the AI assistant';
        toast.error(msg);
        return null;
      }

      if (!primaryGroup) {
        const msg =
          language === 'es'
            ? 'No tienes acceso a ningun grupo'
            : "You don't have access to any group";
        toast.error(msg);
        return null;
      }

      if (primaryGroup.policy && !primaryGroup.policy.canUseAi) {
        const msg =
          language === 'es'
            ? 'El asistente AI no esta disponible para tu rol'
            : 'AI assistant is not available for your role';
        toast.error(msg);
        return null;
      }

      if (!template) {
        const msg =
          language === 'es'
            ? 'Plantilla no disponible'
            : 'Template not available';
        toast.error(msg);
        return null;
      }

      // --- Generate session ID on first turn ---
      const currentSessionId = sessionId ?? generateUUID();
      if (!sessionId) {
        setSessionId(currentSessionId);
      }

      // --- Build conversation history for the edge function ---
      // Include structured results for assistant turns so the AI remembers
      // what it already extracted and asked about on previous turns.
      const historyForRequest = conversationHistory.slice(-6).map((turn) => {
        if (turn.role === 'assistant' && turn.result) {
          // Build a content string that includes both the message AND the structured data
          const structured = {
            message: turn.result.message,
            fieldUpdates: turn.result.fieldUpdates,
            missingFields: turn.result.missingFields,
            followUpQuestion: turn.result.followUpQuestion,
          };
          return {
            role: turn.role,
            content: JSON.stringify(structured).slice(0, 3000),
          };
        }
        return {
          role: turn.role,
          content:
            typeof turn.content === 'string'
              ? turn.content.slice(0, 2000)
              : String(turn.content),
        };
      });

      // --- Call edge function ---
      setIsLoading(true);
      setError(null);

      try {
        const body: Record<string, unknown> = {
          question,
          templateId: template.id,
          currentValues,
          language,
          groupId: primaryGroup.groupId,
          conversationHistory: historyForRequest,
          sessionId: currentSessionId,
        };

        // Attach files if provided
        if (options?.attachments && options.attachments.length > 0) {
          body.attachments = options.attachments;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          'ask-form',
          { body },
        );

        if (fnError) {
          throw new Error(fnError.message || 'Failed to call form AI');
        }

        // Handle error responses from the edge function
        if (data?.error) {
          if (data.error === 'limit_exceeded') {
            const msg =
              data.message ||
              (language === 'es'
                ? 'Limite de preguntas alcanzado'
                : 'Question limit reached');
            toast.error(msg);
            setError(msg);
            return null;
          }
          if (data.error === 'forbidden') {
            const msg =
              data.message ||
              (language === 'es'
                ? 'No tienes acceso a este grupo'
                : "You don't have access to this group");
            toast.error(msg);
            setError(msg);
            return null;
          }
          throw new Error(data.message || data.error);
        }

        const askResult = data as AskFormResult;
        setResult(askResult);

        // Track cumulative field updates
        const newFieldCount = Object.keys(askResult.fieldUpdates).length;
        totalFieldsUpdatedRef.current += newFieldCount;

        // Append turns to conversation history
        const userTurn: ConversationTurn = {
          role: 'user',
          content: question,
          attachments: options?.attachments?.map((a) => ({
            name: a.name,
            type: a.type,
            previewUrl: a.type === 'image' ? a.content : undefined,
          })),
          timestamp: Date.now(),
        };

        const assistantTurn: ConversationTurn = {
          role: 'assistant',
          content: askResult.message || '',
          result: askResult,
          timestamp: Date.now(),
        };

        setConversationHistory((prev) => [...prev, userTurn, assistantTurn]);

        return askResult;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : language === 'es'
              ? 'Error al obtener respuesta'
              : 'Failed to get answer';
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [user, primaryGroup, template, currentValues, language, conversationHistory, sessionId],
  );

  const clearConversation = useCallback(() => {
    setConversationHistory([]);
    setResult(null);
    setError(null);
    setSessionId(null);
    totalFieldsUpdatedRef.current = 0;
  }, []);

  return {
    askForm,
    clearConversation,
    isLoading,
    result,
    error,
    conversationHistory,
    sessionId,
    totalFieldsUpdated: totalFieldsUpdatedRef.current,
    hasFollowUp: !!(result?.followUpQuestion),
  };
}
