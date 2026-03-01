// =============================================================================
// useFormBuilderChat — Hook for AI Builder chat communication
// Sends messages to the form-builder-chat edge function and returns
// structured responses with form updates.
// =============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  BuilderChatMessage,
  FormBuilderChatResponse,
  FormBuilderChatUpdates,
} from '@/types/form-builder';
import type { FormFieldDefinition } from '@/types/forms';

// =============================================================================
// TYPES
// =============================================================================

interface SendMessageParams {
  message: string;
  currentForm: {
    titleEn: string;
    titleEs: string;
    descriptionEn: string;
    descriptionEs: string;
    icon: string;
    iconColor?: string;
    fields: Array<{
      key: string;
      label: string;
      label_es: string;
      type: string;
      section: string;
      required: boolean;
      options?: string[];
      order: number;
    }>;
    instructionsEn: string;
    instructionsEs: string;
    aiTools: string[];
  };
  conversationHistory: BuilderChatMessage[];
  imageBase64?: string;
  fileContent?: string;
  fileName?: string;
  language: 'en' | 'es';
  groupId: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Strip nulls from formUpdates and cast fieldsToModify.updates
 * to Partial<FormFieldDefinition> for type safety at the boundary.
 */
function castFormUpdates(raw: Record<string, unknown>): FormBuilderChatUpdates {
  const result: FormBuilderChatUpdates = {};

  // String fields -- only include if non-null
  for (const key of [
    'titleEn',
    'titleEs',
    'descriptionEn',
    'descriptionEs',
    'icon',
    'iconColor',
    'instructionsEn',
    'instructionsEs',
  ] as const) {
    if (raw[key] != null) (result as Record<string, unknown>)[key] = raw[key];
  }

  if (Array.isArray(raw.aiTools)) result.aiTools = raw.aiTools;
  if (Array.isArray(raw.fieldsToAdd)) result.fieldsToAdd = raw.fieldsToAdd;
  if (Array.isArray(raw.fieldsToRemove)) result.fieldsToRemove = raw.fieldsToRemove;

  if (Array.isArray(raw.fieldsToModify)) {
    result.fieldsToModify = (raw.fieldsToModify as Array<Record<string, unknown>>).map(
      (m) => ({
        key: m.key as string,
        updates: Object.fromEntries(
          Object.entries(m).filter(([k, v]) => k !== 'key' && v != null),
        ) as Partial<FormFieldDefinition>,
      }),
    );
  }

  if (Array.isArray(raw.reorderedFieldKeys)) {
    result.reorderedFieldKeys = raw.reorderedFieldKeys;
  }

  return result;
}

// =============================================================================
// HOOK
// =============================================================================

export function useFormBuilderChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (params: SendMessageParams): Promise<FormBuilderChatResponse | null> => {
      setError(null);
      setIsLoading(true);

      try {
        // Strip assistant messages to just their text content (not full JSON)
        // and limit to last 10 for context window efficiency
        const history = params.conversationHistory.slice(-10).map((m) => ({
          role: m.role,
          content: m.content.slice(0, 2000),
        }));

        const { data, error: fnError } = await supabase.functions.invoke(
          'form-builder-chat',
          {
            body: {
              message: params.message,
              currentForm: params.currentForm,
              conversationHistory: history,
              ...(params.imageBase64 ? { imageBase64: params.imageBase64 } : {}),
              ...(params.fileContent
                ? { fileContent: params.fileContent, fileName: params.fileName }
                : {}),
              language: params.language,
              groupId: params.groupId,
            },
          },
        );

        if (fnError) throw new Error(fnError.message || 'Request failed');
        if (data?.error) throw new Error(data.message || data.error);

        return {
          message: data.message || '',
          formUpdates: castFormUpdates(data.formUpdates || {}),
          changeSummary: Array.isArray(data.changeSummary) ? data.changeSummary : [],
          confidence: data.confidence ?? 0.5,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An error occurred';
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { sendMessage, isLoading, error };
}
