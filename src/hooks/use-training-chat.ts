import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import type { ConversationMessage } from '@/types/training';

interface TrainingAIResponse {
  reply: string;
  suggested_replies: string[];
  topics_update: {
    covered: string[];
    total: string[];
  };
  should_suggest_quiz: boolean;
}

interface UseTrainingChatOptions {
  sectionId: string | undefined;
  enrollmentId: string | undefined;
  contentContext: string;
  topicsTotal: string[];
}

export function useTrainingChat({
  sectionId,
  enrollmentId,
  contentContext,
  topicsTotal: initialTopics,
}: UseTrainingChatOptions) {
  const { user, permissions } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>([]);
  const [topicsCovered, setTopicsCovered] = useState<string[]>([]);
  const [topicsTotal, setTopicsTotal] = useState<string[]>(initialTopics);
  const [shouldSuggestQuiz, setShouldSuggestQuiz] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionSummary, setSessionSummary] = useState('');

  // Load existing conversations for this section
  const { data: existingConversations = [] } = useQuery({
    queryKey: ['training-conversations', sectionId, userId],
    queryFn: async () => {
      if (!sectionId || !userId) return [];

      const { data, error } = await supabase
        .from('course_conversations' as any)
        .select('*')
        .eq('user_id', userId)
        .eq('section_id', sectionId)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!sectionId && !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const resumeSession = useCallback((conversation: any) => {
    setConversationId(conversation.id);
    const msgs = (conversation.messages ?? []) as ConversationMessage[];
    setMessages(msgs);
    setSessionSummary(conversation.session_summary ?? '');
    setTopicsCovered(conversation.topics_discussed ?? []);
    setSuggestedReplies([]);
    setShouldSuggestQuiz(false);
  }, []);

  const startNewSession = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setSuggestedReplies([]);
    setTopicsCovered([]);
    setShouldSuggestQuiz(false);
    setSessionSummary('');
  }, []);

  const persistConversation = useCallback(
    async (
      msgs: ConversationMessage[],
      coveredTopics: string[],
      convId: string | null
    ) => {
      if (!sectionId || !userId) return convId;

      if (convId) {
        await supabase
          .from('course_conversations' as any)
          .update({
            messages: msgs as any,
            topics_discussed: coveredTopics,
            updated_at: new Date().toISOString(),
          })
          .eq('id', convId);
        return convId;
      }

      const { data, error } = await supabase
        .from('course_conversations' as any)
        .insert({
          user_id: userId,
          section_id: sectionId,
          enrollment_id: enrollmentId ?? null,
          messages: msgs as any,
          topics_discussed: coveredTopics,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[training-chat] Failed to persist:', error);
        return null;
      }
      return data.id;
    },
    [sectionId, userId, enrollmentId]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !sectionId || !groupId || isSending) return;

      setIsSending(true);

      const userMessage: ConversationMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setSuggestedReplies([]);

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'ask',
          {
            body: {
              question: text.trim(),
              domain: 'training',
              section_id: sectionId,
              content_context: contentContext,
              conversation_history: updatedMessages.slice(-10),
              session_summary: sessionSummary,
              topics_covered: topicsCovered,
              topics_total: topicsTotal,
              language,
              groupId,
            },
          }
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.message ?? data.error);

        const aiResponse = data as TrainingAIResponse;

        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: aiResponse.reply,
          timestamp: new Date().toISOString(),
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        setSuggestedReplies(aiResponse.suggested_replies ?? []);

        const newCovered = aiResponse.topics_update?.covered ?? topicsCovered;
        const newTotal = aiResponse.topics_update?.total ?? topicsTotal;
        setTopicsCovered(newCovered);
        setTopicsTotal(newTotal);
        setShouldSuggestQuiz(aiResponse.should_suggest_quiz ?? false);

        const newConvId = await persistConversation(
          finalMessages,
          newCovered,
          conversationId
        );
        if (newConvId && !conversationId) {
          setConversationId(newConvId);
        }

        queryClient.invalidateQueries({
          queryKey: ['training-conversations', sectionId, userId],
        });
      } catch (err) {
        console.error('[training-chat] Error:', err);
        const errorMsg: ConversationMessage = {
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
    [
      messages,
      sectionId,
      groupId,
      contentContext,
      sessionSummary,
      topicsCovered,
      topicsTotal,
      language,
      conversationId,
      persistConversation,
      queryClient,
      userId,
      isSending,
    ]
  );

  return {
    messages,
    suggestedReplies,
    topicsCovered,
    topicsTotal,
    shouldSuggestQuiz,
    isSending,
    conversationId,
    existingConversations,
    sendMessage,
    resumeSession,
    startNewSession,
    language,
  };
}
