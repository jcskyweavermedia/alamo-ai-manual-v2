/**
 * useAskTrainingManager Hook
 *
 * Multi-turn conversation hook for the training manager AI.
 * Manages chat history, session continuity, and role-based access.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export interface ManagerAIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface UseAskTrainingManagerReturn {
  messages: ManagerAIMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (question: string) => Promise<void>;
  clearConversation: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useAskTrainingManager(): UseAskTrainingManagerReturn {
  const [messages, setMessages] = useState<ManagerAIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const { user, permissions } = useAuth();
  const { language } = useLanguage();
  const primaryGroup = permissions?.memberships?.[0] ?? null;

  const sendMessage = useCallback(async (question: string) => {
    if (!user || !primaryGroup) {
      toast.error(language === 'es' ? 'Por favor inicia sesion' : 'Please sign in');
      return;
    }

    // Role check
    if (!['manager', 'admin'].includes(primaryGroup.role)) {
      toast.error(language === 'es'
        ? 'Solo disponible para managers y administradores'
        : 'Only available to managers and admins');
      return;
    }

    const userMsg: ManagerAIMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        question,
        language,
        groupId: primaryGroup.groupId,
        domain: 'training_manager',
      };
      if (sessionIdRef.current) {
        body.sessionId = sessionIdRef.current;
      }

      const { data, error: fnError } = await supabase.functions.invoke('ask', { body });

      if (fnError) throw new Error(fnError.message || 'Failed to call AI');

      if (data?.error) {
        if (data.error === 'limit_exceeded') {
          const msg = data.message || (language === 'es' ? 'Limite alcanzado' : 'Limit reached');
          toast.error(msg);
          setError(msg);
          return;
        }
        if (data.error === 'forbidden') {
          const msg = data.message || (language === 'es' ? 'Acceso denegado' : 'Access denied');
          toast.error(msg);
          setError(msg);
          return;
        }
        throw new Error(data.message || data.error);
      }

      // Update session ID
      if (data?.sessionId) sessionIdRef.current = data.sessionId;

      const assistantMsg: ManagerAIMessage = {
        role: 'assistant',
        content: data?.answer || '',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [user, primaryGroup, language]);

  const clearConversation = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearConversation };
}
