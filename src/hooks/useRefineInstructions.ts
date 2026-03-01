// =============================================================================
// useRefineInstructions Hook — AI Instruction Refinement
//
// Calls the `refine-form-instructions` edge function to improve admin-written
// instructions for form templates. Supports multi-turn conversational
// refinement with internal history management.
//
// The edge function returns structured JSON:
//   { refinedInstructions, explanation, suggestions, usage }
//
// Usage:
//   const { refine, isRefining, error, conversationHistory, clearHistory } =
//     useRefineInstructions();
//
//   // First turn
//   const result = await refine({
//     rawInstructions: "Check the handbook for rules broken",
//     templateContext: { title, fields, enabledTools },
//     language: "en",
//     groupId: "...",
//   });
//
//   // Follow-up turn (conversationHistory is managed internally)
//   const result2 = await refine({
//     rawInstructions: "Also add a step about notifying the manager",
//     templateContext: { title, fields, enabledTools },
//     language: "en",
//     groupId: "...",
//   });
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { FormFieldDefinition } from '@/types/forms';
import type { RefineInstructionsResult, RefinementMessage } from '@/types/form-builder';

// =============================================================================
// TYPES
// =============================================================================

/** Summary of a field sent to the edge function (subset of FormFieldDefinition). */
interface FieldSummary {
  key: string;
  type: string;
  label: string;
  label_es?: string;
  required: boolean;
  options?: string[];
  ai_hint?: string;
}

/** Template context sent to the edge function. */
interface TemplateContext {
  title: string;
  fields: FieldSummary[];
  enabledTools: string[];
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
}

/** Parameters for the refine() call. */
export interface RefineParams {
  /** The raw instructions text (admin's draft or follow-up). */
  rawInstructions: string;
  /** Template context for the AI (title, fields, tools). */
  templateContext: TemplateContext;
  /** Language for the refined output. */
  language: 'en' | 'es';
  /** Group ID for usage tracking. */
  groupId: string;
  /** Optional: cross-language context (e.g., EN instructions when refining ES). */
  crossLanguageContext?: string;
}

/** Return type of the hook. */
export interface UseRefineInstructionsReturn {
  /** Refine instructions (first turn or follow-up). History is managed internally. */
  refine: (params: RefineParams) => Promise<RefineInstructionsResult | null>;
  /** Whether a refinement call is in progress. */
  isRefining: boolean;
  /** Last error message, or null. */
  error: string | null;
  /** The full conversation history (for display in AIRefineChat). */
  conversationHistory: RefinementMessage[];
  /** Clear the conversation history (start fresh). */
  clearHistory: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert FormFieldDefinition[] to the lightweight FieldSummary[] sent to the
 * edge function. Strips unnecessary properties to keep the payload small.
 */
export function summarizeFields(fields: FormFieldDefinition[]): FieldSummary[] {
  return fields
    .filter(f => f.type !== 'header' && f.type !== 'instructions')
    .map(f => ({
      key: f.key,
      type: f.type,
      label: f.label,
      ...(f.label_es ? { label_es: f.label_es } : {}),
      required: f.required ?? false,
      ...(f.options && f.options.length > 0 ? { options: f.options } : {}),
      ...(f.ai_hint ? { ai_hint: f.ai_hint } : {}),
    }));
}

/**
 * Convert RefinementMessage[] to the minimal { role, content } array
 * expected by the edge function's conversationHistory parameter.
 */
function toConversationHistory(
  messages: RefinementMessage[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map(m => ({
    role: m.role,
    content: m.role === 'assistant' ? (m.refinedInstructions || m.content) : m.content,
  }));
}

// =============================================================================
// HOOK
// =============================================================================

export function useRefineInstructions(): UseRefineInstructionsReturn {
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<RefinementMessage[]>([]);

  // Ref to access the latest conversation history inside the callback
  // without including it in the dependency array (avoids stale closure).
  const historyRef = useRef<RefinementMessage[]>([]);
  historyRef.current = conversationHistory;

  const refine = useCallback(
    async (params: RefineParams): Promise<RefineInstructionsResult | null> => {
      setIsRefining(true);
      setError(null);

      try {
        // Add the user's message to history
        const userMessage: RefinementMessage = {
          role: 'user',
          content: params.rawInstructions,
          timestamp: new Date().toISOString(),
        };

        const updatedHistory = [...historyRef.current, userMessage];

        // Build the conversationHistory for the edge function
        // (only prior messages, not the current one — it goes as rawInstructions)
        const priorHistory = toConversationHistory(historyRef.current);

        const { data, error: invokeError } = await supabase.functions.invoke(
          'refine-form-instructions',
          {
            body: {
              rawInstructions: params.rawInstructions,
              templateContext: params.templateContext,
              language: params.language,
              conversationHistory: priorHistory,
              groupId: params.groupId,
              currentMetadata: {
                titleEn: params.templateContext.title,
                titleEs: params.templateContext.titleEs || '',
                descriptionEn: params.templateContext.descriptionEn || '',
                descriptionEs: params.templateContext.descriptionEs || '',
              },
              ...(params.crossLanguageContext
                ? { crossLanguageContext: params.crossLanguageContext }
                : {}),
            },
          },
        );

        if (invokeError) throw invokeError;

        // Validate the response shape
        if (!data || typeof data.refinedInstructions !== 'string') {
          throw new Error('Invalid response from refine-form-instructions');
        }

        const result: RefineInstructionsResult = {
          refinedInstructions: data.refinedInstructions,
          refinedInstructionsEs: data.refinedInstructionsEs || '',
          recommendedTools: data.recommendedTools || [],
          suggestedSystemPrompt: data.suggestedSystemPrompt || '',
          explanation: data.explanation || '',
          suggestions: data.suggestions || [],
          suggestedTitleEn: data.suggestedTitleEn || undefined,
          suggestedTitleEs: data.suggestedTitleEs || undefined,
          suggestedDescriptionEn: data.suggestedDescriptionEn || undefined,
          suggestedDescriptionEs: data.suggestedDescriptionEs || undefined,
          suggestedIcon: data.suggestedIcon || undefined,
          suggestedIconColor: data.suggestedIconColor || undefined,
          suggestedFieldCorrections: Array.isArray(data.suggestedFieldCorrections) ? data.suggestedFieldCorrections : [],
          usage: data.usage || {
            dailyUsed: 0,
            dailyLimit: 0,
            monthlyUsed: 0,
            monthlyLimit: 0,
          },
        };

        // Add the assistant's response to history
        const assistantMessage: RefinementMessage = {
          role: 'assistant',
          content: result.explanation,
          timestamp: new Date().toISOString(),
          refinedInstructions: result.refinedInstructions,
          explanation: result.explanation,
          suggestions: result.suggestions,
          recommendedTools: result.recommendedTools,
          instructionsEs: result.refinedInstructionsEs,
          suggestedSystemPrompt: result.suggestedSystemPrompt,
        };

        const finalHistory = [...updatedHistory, assistantMessage];
        setConversationHistory(finalHistory);
        historyRef.current = finalHistory;

        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Refinement failed';
        setError(msg);
        return null;
      } finally {
        setIsRefining(false);
      }
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setConversationHistory([]);
    historyRef.current = [];
    setError(null);
  }, []);

  return {
    refine,
    isRefining,
    error,
    conversationHistory,
    clearHistory,
  };
}
