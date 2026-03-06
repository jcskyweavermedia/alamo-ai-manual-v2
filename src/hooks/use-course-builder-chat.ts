// =============================================================================
// useCourseBuilderChat — Chat interface for the AI builder panel
// Sends messages to build-course with step='chat_edit', manages message history.
// =============================================================================

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCourseBuilder } from '@/contexts/CourseBuilderContext';
import type {
  CourseBuilderChatMessage,
  CourseBuilderChatUpdates,
} from '@/types/course-builder';

export function useCourseBuilderChat() {
  const { state, dispatch } = useCourseBuilder();

  const sendMessage = useCallback(async (instruction: string, language: 'en' | 'es' = 'en') => {
    if (!state.courseId || !state.activeSectionId || !instruction.trim()) return;

    // Add user message
    const userMessage: CourseBuilderChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: instruction.trim(),
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'BUILDER_CHAT_ADD_MESSAGE', payload: userMessage });
    dispatch({ type: 'BUILDER_CHAT_SET_LOADING', payload: true });

    try {
      const { data, error } = await supabase.functions.invoke('build-course', {
        body: {
          course_id: state.courseId,
          section_id: state.activeSectionId,
          step: 'chat_edit',
          instruction: instruction.trim(),
          language,
        },
      });

      if (error) throw new Error(error.message || 'Chat request failed');
      if (data?.error) throw new Error(data.error);

      // Apply updates if any
      const updates = data?.updates as CourseBuilderChatUpdates | undefined;
      if (updates) {
        dispatch({ type: 'APPLY_CHAT_COURSE_UPDATES', payload: updates });
      }

      // Add assistant message
      const assistantMessage: CourseBuilderChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: (data?.message as string) || 'Done.',
        timestamp: new Date().toISOString(),
        changeSummary: (data?.changeSummary as string[]) || undefined,
        confidence: (data?.confidence as number) || undefined,
      };
      dispatch({ type: 'BUILDER_CHAT_ADD_MESSAGE', payload: assistantMessage });
    } catch (err) {
      console.error('[useCourseBuilderChat] sendMessage error:', err);
      const errorMessage: CourseBuilderChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: 'BUILDER_CHAT_ADD_MESSAGE', payload: errorMessage });
    } finally {
      dispatch({ type: 'BUILDER_CHAT_SET_LOADING', payload: false });
    }
  }, [state.courseId, state.activeSectionId, dispatch]);

  const clearChat = useCallback(() => {
    dispatch({ type: 'BUILDER_CHAT_CLEAR' });
  }, [dispatch]);

  return {
    sendMessage,
    messages: state.builderChatMessages,
    isLoading: state.builderChatLoading,
    clearChat,
  };
}
