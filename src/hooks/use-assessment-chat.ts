/**
 * useAssessmentChat Hook
 *
 * Core state machine for conversational assessment in training courses.
 * Manages the full lifecycle:
 *   idle -> resume detection -> onboarding -> conversation -> wrap-up -> evaluation -> results
 *
 * Uses useReducer for atomic state transitions. Calls two Supabase Edge Functions:
 * - course-assess  (actions: start, message)
 * - course-evaluate (action: conversation_evaluation)
 */

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

// =============================================================================
// EXPORTED TYPES
// =============================================================================

export interface AssessmentMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  teachingMoment?: boolean;
}

export interface AssessmentResults {
  score: number;
  passed: boolean;
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert';
  conversationSummary: string;
  topicsCovered: number;
  topicsTotal: number;
  studentFeedback: {
    strengths: string[];
    areasForImprovement: string[];
    encouragement: string;
  };
}

export type AssessmentPhase =
  | 'idle'
  | 'resuming'
  | 'onboarding'
  | 'starting'
  | 'conversing'
  | 'sending'
  | 'wrapping_up'
  | 'evaluating'
  | 'results'
  | 'error';

export interface AssessmentState {
  phase: AssessmentPhase;
  messages: AssessmentMessage[];
  topicsCovered: number;
  topicsTotal: number;
  attemptId: string | null;
  results: AssessmentResults | null;
  error: string | null;
}

// =============================================================================
// REDUCER ACTIONS
// =============================================================================

type AssessmentAction =
  | { type: 'CHECK_RESUME' }
  | {
      type: 'RESUME_FOUND';
      messages: AssessmentMessage[];
      attemptId: string;
      topicsCovered: number;
      topicsTotal: number;
    }
  | { type: 'NO_RESUME' }
  | { type: 'START_ASSESSMENT' }
  | {
      type: 'ASSESSMENT_STARTED';
      messages: AssessmentMessage[];
      attemptId: string;
      topicsCovered: number;
      topicsTotal: number;
    }
  | { type: 'SEND_MESSAGE'; message: AssessmentMessage }
  | {
      type: 'RECEIVE_REPLY';
      reply: AssessmentMessage;
      topicsCovered: number;
      wrapUp: boolean;
    }
  | { type: 'REQUEST_EVALUATION' }
  | { type: 'EVALUATION_COMPLETE'; results: AssessmentResults }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: AssessmentState = {
  phase: 'idle',
  messages: [],
  topicsCovered: 0,
  topicsTotal: 0,
  attemptId: null,
  results: null,
  error: null,
};

// =============================================================================
// REDUCER (pure function, defined outside the component)
// =============================================================================

/**
 * Tracks the phase before an error so RETRY can restore it.
 * We store it on the state object via a non-exported field to keep the
 * reducer pure — the alternative (a ref) would leak into the reducer.
 */
interface InternalState extends AssessmentState {
  _phaseBeforeError?: AssessmentPhase;
}

function assessmentReducer(
  state: InternalState,
  action: AssessmentAction
): InternalState {
  switch (action.type) {
    case 'CHECK_RESUME':
      return {
        ...state,
        phase: 'resuming',
        error: null,
      };

    case 'RESUME_FOUND':
      return {
        ...state,
        phase: 'conversing',
        messages: action.messages,
        attemptId: action.attemptId,
        topicsCovered: action.topicsCovered,
        topicsTotal: action.topicsTotal,
        error: null,
      };

    case 'NO_RESUME':
      return {
        ...state,
        phase: 'onboarding',
        error: null,
      };

    case 'START_ASSESSMENT':
      return {
        ...state,
        phase: 'starting',
        messages: [],
        topicsCovered: 0,
        topicsTotal: 0,
        attemptId: null,
        results: null,
        error: null,
      };

    case 'ASSESSMENT_STARTED':
      return {
        ...state,
        phase: 'conversing',
        messages: action.messages,
        attemptId: action.attemptId,
        topicsCovered: action.topicsCovered,
        topicsTotal: action.topicsTotal,
        error: null,
      };

    case 'SEND_MESSAGE':
      return {
        ...state,
        phase: 'sending',
        messages: [...state.messages, action.message],
      };

    case 'RECEIVE_REPLY':
      return {
        ...state,
        phase: action.wrapUp ? 'wrapping_up' : 'conversing',
        messages: [...state.messages, action.reply],
        topicsCovered: action.topicsCovered,
      };

    case 'REQUEST_EVALUATION':
      return {
        ...state,
        phase: 'evaluating',
        error: null,
      };

    case 'EVALUATION_COMPLETE':
      return {
        ...state,
        phase: 'results',
        results: action.results,
        error: null,
      };

    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
        _phaseBeforeError: state.phase !== 'error' ? state.phase : state._phaseBeforeError,
      };

    case 'RETRY': {
      const fallback = state._phaseBeforeError ?? 'onboarding';
      // For transient phases (starting, sending, evaluating), fall back
      // to the last actionable phase
      const retryPhase: AssessmentPhase =
        fallback === 'starting'
          ? 'onboarding'
          : fallback === 'sending'
            ? 'conversing'
            : fallback === 'evaluating'
              ? 'wrapping_up'
              : fallback === 'resuming'
                ? 'onboarding'
                : fallback;
      return {
        ...state,
        phase: retryPhase,
        error: null,
        _phaseBeforeError: undefined,
      };
    }

    case 'RESET':
      return { ...initialState };

    default:
      return state;
  }
}

// =============================================================================
// HOOK OPTIONS & RETURN TYPES
// =============================================================================

interface UseAssessmentChatOptions {
  sectionId: string;
  enrollmentId: string;
  language: 'en' | 'es';
  groupId: string;
}

interface UseAssessmentChatReturn {
  state: AssessmentState;
  startAssessment: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  endEarly: () => Promise<void>;
  requestEvaluation: () => Promise<void>;
  retry: () => void;
  resumeAttempt: (attemptId: string) => Promise<void>;
  abandonAndRestart: () => Promise<void>;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useAssessmentChat(
  options: UseAssessmentChatOptions
): UseAssessmentChatReturn {
  const { sectionId, enrollmentId, language, groupId } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const [state, dispatch] = useReducer(assessmentReducer, initialState);

  // Ref to prevent double-sends while a request is in-flight
  const inFlightRef = useRef(false);

  // Ref to track whether resume detection has already run
  const resumeCheckedRef = useRef(false);

  // ─── RESUME DETECTION (on mount) ────────────────────────────────────────────

  useEffect(() => {
    if (!sectionId || !userId || resumeCheckedRef.current) return;
    resumeCheckedRef.current = true;

    const checkResume = async () => {
      dispatch({ type: 'CHECK_RESUME' });

      try {
        // Look for an in-progress conversation assessment attempt
        const { data: existing, error: attemptError } = await supabase
          .from('quiz_attempts' as never)
          .select('id, questions_covered, competency_score')
          .eq('section_id', sectionId)
          .eq('quiz_mode', 'conversation')
          .eq('status', 'in_progress')
          .order('created_at', { ascending: false })
          .limit(1);

        if (attemptError) {
          console.error('[assessment-chat] Resume check failed:', attemptError);
          dispatch({ type: 'NO_RESUME' });
          return;
        }

        if (!existing || existing.length === 0) {
          dispatch({ type: 'NO_RESUME' });
          return;
        }

        const attempt = existing[0] as {
          id: string;
          questions_covered: number;
          competency_score: number | null;
        };

        // Load conversation messages for this attempt
        const { data: msgs, error: msgsError } = await supabase
          .from('conversation_messages' as never)
          .select('role, content, metadata, created_at')
          .eq('attempt_id', attempt.id)
          .order('created_at', { ascending: true });

        if (msgsError) {
          console.error('[assessment-chat] Failed to load messages:', msgsError);
          dispatch({ type: 'NO_RESUME' });
          return;
        }

        // Load total questions count for this section
        const { count: totalQuestions } = await supabase
          .from('quiz_questions' as never)
          .select('id', { count: 'exact', head: true })
          .eq('section_id', sectionId)
          .eq('is_active', true);

        const messages: AssessmentMessage[] = ((msgs ?? []) as Array<{
          role: string;
          content: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }>).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at,
          teachingMoment: m.metadata
            ? (m.metadata as Record<string, unknown>).teaching_moment === true
            : undefined,
        }));

        dispatch({
          type: 'RESUME_FOUND',
          messages,
          attemptId: attempt.id,
          topicsCovered: attempt.questions_covered ?? 0,
          topicsTotal: totalQuestions ?? 0,
        });
      } catch (err) {
        console.error('[assessment-chat] Resume check error:', err);
        dispatch({ type: 'NO_RESUME' });
      }
    };

    checkResume();
  }, [sectionId, userId]);

  // ─── START ASSESSMENT ───────────────────────────────────────────────────────

  const startAssessment = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    dispatch({ type: 'START_ASSESSMENT' });

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-assess',
        {
          body: {
            action: 'start',
            section_id: sectionId,
            enrollment_id: enrollmentId,
            language,
            groupId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message || 'Request failed');
      if (data?.error) throw new Error(data.message || data.error);

      const response = data as {
        reply: string;
        topics_covered: number;
        topics_total: number;
        teaching_moment: boolean;
        wrap_up: boolean;
        attempt_id: string;
      };

      const aiMessage: AssessmentMessage = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        teachingMoment: response.teaching_moment || undefined,
      };

      dispatch({
        type: 'ASSESSMENT_STARTED',
        messages: [aiMessage],
        attemptId: response.attempt_id,
        topicsCovered: response.topics_covered,
        topicsTotal: response.topics_total,
      });
    } catch (err) {
      console.error('[assessment-chat] startAssessment error:', err);
      dispatch({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to start assessment',
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [sectionId, enrollmentId, language, groupId]);

  // ─── SEND MESSAGE ───────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !state.attemptId || inFlightRef.current) return;
      inFlightRef.current = true;

      const userMessage: AssessmentMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      dispatch({ type: 'SEND_MESSAGE', message: userMessage });

      try {
        const { data, error: fnError } = await supabase.functions.invoke(
          'course-assess',
          {
            body: {
              action: 'message',
              section_id: sectionId,
              enrollment_id: enrollmentId,
              language,
              groupId,
              message: text.trim(),
              attempt_id: state.attemptId,
            },
          }
        );

        if (fnError) throw new Error(fnError.message || 'Request failed');
        if (data?.error) throw new Error(data.message || data.error);

        const response = data as {
          reply: string;
          topics_covered: number;
          topics_total: number;
          teaching_moment: boolean;
          wrap_up: boolean;
          attempt_id: string;
        };

        const aiReply: AssessmentMessage = {
          role: 'assistant',
          content: response.reply,
          timestamp: new Date().toISOString(),
          teachingMoment: response.teaching_moment || undefined,
        };

        dispatch({
          type: 'RECEIVE_REPLY',
          reply: aiReply,
          topicsCovered: response.topics_covered,
          wrapUp: response.wrap_up,
        });
      } catch (err) {
        console.error('[assessment-chat] sendMessage error:', err);
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Failed to send message',
        });
      } finally {
        inFlightRef.current = false;
      }
    },
    [state.attemptId, sectionId, enrollmentId, language, groupId]
  );

  // ─── END EARLY ──────────────────────────────────────────────────────────────

  const endEarly = useCallback(async () => {
    if (!state.attemptId || inFlightRef.current) return;
    inFlightRef.current = true;

    const wrapUpMessage: AssessmentMessage = {
      role: 'user',
      content: '__WRAP_UP__',
      timestamp: new Date().toISOString(),
    };

    dispatch({ type: 'SEND_MESSAGE', message: wrapUpMessage });

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-assess',
        {
          body: {
            action: 'message',
            section_id: sectionId,
            enrollment_id: enrollmentId,
            language,
            groupId,
            message: '__WRAP_UP__',
            attempt_id: state.attemptId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message || 'Request failed');
      if (data?.error) throw new Error(data.message || data.error);

      const response = data as {
        reply: string;
        topics_covered: number;
        topics_total: number;
        teaching_moment: boolean;
        wrap_up: boolean;
        attempt_id: string;
      };

      const aiReply: AssessmentMessage = {
        role: 'assistant',
        content: response.reply,
        timestamp: new Date().toISOString(),
        teachingMoment: response.teaching_moment || undefined,
      };

      dispatch({
        type: 'RECEIVE_REPLY',
        reply: aiReply,
        topicsCovered: response.topics_covered,
        wrapUp: true, // Force wrap-up regardless of response
      });
    } catch (err) {
      console.error('[assessment-chat] endEarly error:', err);
      dispatch({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to end assessment',
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [state.attemptId, sectionId, enrollmentId, language, groupId]);

  // ─── REQUEST EVALUATION ─────────────────────────────────────────────────────

  const requestEvaluation = useCallback(async () => {
    if (!state.attemptId || inFlightRef.current) return;
    inFlightRef.current = true;

    dispatch({ type: 'REQUEST_EVALUATION' });

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'course-evaluate',
        {
          body: {
            action: 'conversation_evaluation',
            attempt_id: state.attemptId,
            section_id: sectionId,
            enrollment_id: enrollmentId,
            language,
            groupId,
          },
        }
      );

      if (fnError) throw new Error(fnError.message || 'Request failed');
      if (data?.error) throw new Error(data.message || data.error);

      const response = data as {
        score: number;
        passed: boolean;
        competency_level: 'novice' | 'competent' | 'proficient' | 'expert';
        conversation_summary: string;
        topics_covered: number;
        topics_total: number;
        student_feedback: {
          strengths: string[];
          areas_for_improvement: string[];
          encouragement: string;
        };
      };

      const results: AssessmentResults = {
        score: response.score,
        passed: response.passed,
        competencyLevel: response.competency_level,
        conversationSummary: response.conversation_summary,
        topicsCovered: response.topics_covered,
        topicsTotal: response.topics_total,
        studentFeedback: {
          strengths: response.student_feedback?.strengths ?? [],
          areasForImprovement: response.student_feedback?.areas_for_improvement ?? [],
          encouragement: response.student_feedback?.encouragement ?? '',
        },
      };

      dispatch({ type: 'EVALUATION_COMPLETE', results });

      // Invalidate relevant caches so progress reflects the new evaluation
      queryClient.invalidateQueries({ queryKey: ['section-progress'] });
      queryClient.invalidateQueries({ queryKey: ['course-sections'] });
      queryClient.invalidateQueries({ queryKey: ['course-assessment'] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['programs'] });
      queryClient.invalidateQueries({ queryKey: ['program-enrollment'] });
    } catch (err) {
      console.error('[assessment-chat] requestEvaluation error:', err);
      dispatch({
        type: 'ERROR',
        error: err instanceof Error ? err.message : 'Failed to evaluate assessment',
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [state.attemptId, sectionId, enrollmentId, language, groupId, queryClient]);

  // ─── RETRY ──────────────────────────────────────────────────────────────────

  const retry = useCallback(() => {
    dispatch({ type: 'RETRY' });
  }, []);

  // ─── RESUME ATTEMPT ─────────────────────────────────────────────────────────

  const resumeAttempt = useCallback(
    async (attemptId: string) => {
      dispatch({ type: 'CHECK_RESUME' });

      try {
        // Load conversation messages for the given attempt
        const { data: msgs, error: msgsError } = await supabase
          .from('conversation_messages' as never)
          .select('role, content, metadata, created_at')
          .eq('attempt_id', attemptId)
          .order('created_at', { ascending: true });

        if (msgsError) throw msgsError;

        // Load total questions count for this section
        const { count: totalQuestions } = await supabase
          .from('quiz_questions' as never)
          .select('id', { count: 'exact', head: true })
          .eq('section_id', sectionId)
          .eq('is_active', true);

        // Load the attempt to get questions_covered
        const { data: attemptData, error: attemptError } = await supabase
          .from('quiz_attempts' as never)
          .select('questions_covered')
          .eq('id', attemptId)
          .limit(1);

        if (attemptError) throw attemptError;

        const covered =
          attemptData && attemptData.length > 0
            ? (attemptData[0] as { questions_covered: number }).questions_covered
            : 0;

        const messages: AssessmentMessage[] = ((msgs ?? []) as Array<{
          role: string;
          content: string;
          metadata: Record<string, unknown> | null;
          created_at: string;
        }>).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.created_at,
          teachingMoment: m.metadata
            ? (m.metadata as Record<string, unknown>).teaching_moment === true
            : undefined,
        }));

        dispatch({
          type: 'RESUME_FOUND',
          messages,
          attemptId,
          topicsCovered: covered,
          topicsTotal: totalQuestions ?? 0,
        });
      } catch (err) {
        console.error('[assessment-chat] resumeAttempt error:', err);
        dispatch({
          type: 'ERROR',
          error: err instanceof Error ? err.message : 'Failed to resume attempt',
        });
      }
    },
    [sectionId]
  );

  // ─── ABANDON AND RESTART ────────────────────────────────────────────────────

  const abandonAndRestart = useCallback(async () => {
    if (state.attemptId) {
      try {
        await supabase
          .from('quiz_attempts' as never)
          .update({ status: 'abandoned' } as never)
          .eq('id', state.attemptId);
      } catch (err) {
        console.error('[assessment-chat] Failed to abandon attempt:', err);
        // Continue with reset even if the update fails
      }
    }

    dispatch({ type: 'RESET' });

    // Reset the resume check ref so the next mount-like flow skips
    // directly to onboarding (the old attempt is now abandoned)
    resumeCheckedRef.current = true;

    // Transition to onboarding so the user can start fresh
    dispatch({ type: 'NO_RESUME' });
  }, [state.attemptId]);

  // ─── PUBLIC STATE (strip internal fields) ───────────────────────────────────

  const publicState: AssessmentState = {
    phase: state.phase,
    messages: state.messages,
    topicsCovered: state.topicsCovered,
    topicsTotal: state.topicsTotal,
    attemptId: state.attemptId,
    results: state.results,
    error: state.error,
  };

  return {
    state: publicState,
    startAssessment,
    sendMessage,
    endEarly,
    requestEvaluation,
    retry,
    resumeAttempt,
    abandonAndRestart,
  };
}
