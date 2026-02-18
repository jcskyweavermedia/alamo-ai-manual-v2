/**
 * usePracticeTutor Hook
 *
 * Manages the Practice Tutor conversational AI session:
 * - Sends messages to course-tutor edge function
 * - Tracks readiness score and test suggestion
 * - Loads/resumes existing tutor sessions
 */

import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type { TutorMessage } from '@/types/training';

interface UsePracticeTutorOptions {
  courseId: string | undefined;
  enrollmentId: string | undefined;
}

export function usePracticeTutor({ courseId, enrollmentId }: UsePracticeTutorOptions) {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [suggestTest, setSuggestTest] = useState(false);
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Load existing sessions for this course
  const { data: existingSessions = [] } = useQuery({
    queryKey: ['tutor-sessions', courseId, userId],
    queryFn: async () => {
      if (!courseId || !userId) return [];

      const { data, error } = await supabase
        .from('tutor_sessions' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!courseId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const resumeSession = useCallback((session: any) => {
    setSessionId(session.id);
    const msgs = (session.messages ?? []).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
      readinessScore: m.readinessScore,
    }));
    setMessages(msgs);
    setReadinessScore(session.readiness_score ?? 0);
    setSuggestTest(session.readiness_suggested ?? false);
    setTopicsCovered(session.topics_covered ?? []);
  }, []);

  const startNewSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setReadinessScore(0);
    setSuggestTest(false);
    setTopicsCovered([]);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !courseId || !groupId || isSending) return;

      setIsSending(true);

      const userMsg: TutorMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'course-tutor',
          {
            body: {
              course_id: courseId,
              language,
              groupId,
              message: text.trim(),
              session_id: sessionId,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.message ?? data.error);

        const assistantMsg: TutorMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toISOString(),
          readinessScore: data.readiness_score,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setReadinessScore(data.readiness_score ?? readinessScore);
        setSuggestTest(data.suggest_test ?? false);
        setTopicsCovered(data.topics_covered ?? topicsCovered);

        if (data.session_id && !sessionId) {
          setSessionId(data.session_id);
        }

        queryClient.invalidateQueries({
          queryKey: ['tutor-sessions', courseId, userId],
        });
        queryClient.invalidateQueries({
          queryKey: ['course-assessment'],
        });
      } catch (err) {
        console.error('[usePracticeTutor] Error:', err);
        const errorMsg: TutorMessage = {
          role: 'assistant',
          content:
            language === 'es'
              ? 'Lo siento, hubo un error. Por favor intenta de nuevo.'
              : 'Sorry, there was an error. Please try again.',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [courseId, groupId, language, sessionId, isSending, readinessScore, topicsCovered, queryClient, userId]
  );

  return {
    messages,
    readinessScore,
    suggestTest,
    topicsCovered,
    isSending,
    sessionId,
    existingSessions,
    sendMessage,
    resumeSession,
    startNewSession,
    language,
  };
}
