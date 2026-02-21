/**
 * AssessmentChatPanel
 *
 * Full-screen conversational assessment UI for the bilingual (EN/ES) training system.
 * Orchestrates the entire assessment experience:
 *   onboarding -> chat -> evaluation -> results
 *
 * This is a controlled component: all state is received via props from useAssessmentChat.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChatBubble } from '@/components/training/ChatBubble';
import { TopicProgressBar } from '@/components/training/TopicProgressBar';
import { QuizResultsView } from '@/components/training/QuizResults';
import { VoiceConsentDialog } from '@/components/training/VoiceConsentDialog';
import {
  useVoiceRecording,
  formatRecordingTime,
  isRecordingSupported,
} from '@/hooks/use-voice-recording';
import { cn } from '@/lib/utils';
import {
  Mic,
  Square,
  Send,
  Loader2,
  AlertCircle,
  MoreVertical,
  MessageSquare,
  Clock,
  BarChart3,
} from 'lucide-react';

import type { AssessmentState, AssessmentResults, AssessmentMessage } from '@/hooks/use-assessment-chat';

// =============================================================================
// PROPS
// =============================================================================

interface AssessmentChatPanelProps {
  state: AssessmentState;
  sectionTitle: string;
  passingScore: number;
  onStartAssessment: () => Promise<void>;
  onSendMessage: (text: string) => Promise<void>;
  onEndEarly: () => Promise<void>;
  onRequestEvaluation: () => Promise<void>;
  onRetry: () => void;
  onResumeAttempt: (attemptId: string) => Promise<void>;
  onAbandonAndRestart: () => Promise<void>;
  onContinue: () => void;
  onRetryAssessment: () => void;
  language: 'en' | 'es';
  className?: string;
}

// =============================================================================
// LOADING DOTS
// =============================================================================

function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AssessmentChatPanel({
  state,
  sectionTitle,
  passingScore,
  onStartAssessment,
  onSendMessage,
  onEndEarly,
  onRequestEvaluation,
  onRetry,
  onResumeAttempt,
  onAbandonAndRestart,
  onContinue,
  onRetryAssessment,
  language,
  className,
}: AssessmentChatPanelProps) {
  const isEs = language === 'es';

  // ── Local UI State ──────────────────────────────────────────────────────────
  const [input, setInput] = useState('');
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showVoiceConsent, setShowVoiceConsent] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [waitMessage, setWaitMessage] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // ── Bilingual Text ──────────────────────────────────────────────────────────
  const TEXT = {
    onboardingTitle: isEs ? 'Evaluacion por Conversacion' : 'Conversation Quiz',
    onboardingDesc: isEs
      ? `Tu instructor te hara preguntas sobre "${sectionTitle}" en una conversacion. Responde con tus propias palabras.`
      : `Your trainer will ask you questions about "${sectionTitle}" through a conversation. Answer in your own words.`,
    voiceHint: isEs ? 'Puedes escribir o usar el microfono' : 'You can type or use the mic',
    durationHint: isEs ? 'Generalmente toma 5-8 minutos' : 'Usually takes 5-8 minutes',
    quotaHint: isEs ? 'Usa ~13 preguntas de IA' : 'Uses ~13 AI questions',
    startButton: isEs ? 'Comenzar Conversacion' : 'Start Conversation',
    resumeButton: isEs ? 'Reanudar Evaluacion' : 'Resume Assessment',
    startFresh: isEs ? 'Comenzar de Nuevo' : 'Start Fresh',
    resumeBanner: isEs
      ? 'Tienes una evaluacion en progreso para esta seccion.'
      : 'You have an in-progress assessment for this section.',
    inputPlaceholder: isEs ? 'Escribe tu respuesta...' : 'Type your answer...',
    viewResults: isEs ? 'Ver Mi Evaluacion' : 'View My Assessment',
    evaluating: isEs
      ? 'Tu instructor esta preparando tu evaluacion...'
      : 'Your trainer is preparing your evaluation...',
    starting: isEs ? 'Iniciando tu evaluacion...' : 'Starting your assessment...',
    endAssessment: isEs ? 'Terminar Evaluacion' : 'End Assessment',
    endConfirmTitle: isEs ? 'Terminar la evaluacion ahora?' : 'End the assessment now?',
    endConfirmDesc: isEs
      ? 'Tu instructor evaluara basado en lo que has cubierto hasta ahora.'
      : "Your trainer will evaluate based on what you've covered so far.",
    cancel: isEs ? 'Cancelar' : 'Cancel',
    endAndEvaluate: isEs ? 'Terminar y Evaluar' : 'End & Evaluate',
    retry: isEs ? 'Reintentar' : 'Retry',
    checking: isEs ? 'Verificando...' : 'Checking...',
    transcribing: isEs ? 'Transcribiendo...' : 'Transcribing...',
    recording: isEs ? 'Grabando...' : 'Recording...',
  };

  // ── Voice Recording ─────────────────────────────────────────────────────────
  const voice = useVoiceRecording({
    language,
    onTranscription: (text) => setInput(text),
    onError: (err) => setVoiceError(err),
  });

  const canUseVoice = isRecordingSupported();

  // ── Auto-scroll on new messages ─────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages.length, state.phase]);

  // ── Keyboard occlusion handling ─────────────────────────────────────────────
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const keyboardHeight = window.innerHeight - vv.height;
      chatContainerRef.current?.style.setProperty(
        '--kb-height',
        `${Math.max(0, keyboardHeight)}px`
      );
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // ── Slow response handling ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'sending') {
      setWaitMessage(null);
      const t1 = setTimeout(
        () => setWaitMessage(isEs ? 'Tu instructor esta pensando...' : 'Your trainer is thinking...'),
        3000
      );
      const t2 = setTimeout(
        () => setWaitMessage(isEs ? 'Tomando un poco mas de tiempo...' : 'Taking a bit longer than usual...'),
        8000
      );
      waitTimerRef.current = [t1, t2];
    } else {
      setWaitMessage(null);
      waitTimerRef.current.forEach(clearTimeout);
      waitTimerRef.current = [];
    }
    return () => {
      waitTimerRef.current.forEach(clearTimeout);
    };
  }, [state.phase, isEs]);

  // ── Focus input after phase transitions ─────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'conversing') {
      inputRef.current?.focus();
    }
  }, [state.phase]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || state.phase === 'sending') return;
    setInput('');
    await onSendMessage(text);
    inputRef.current?.focus();
  }, [input, state.phase, onSendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleMicPress = useCallback(() => {
    if (voice.isRecording) {
      voice.stopRecording();
      return;
    }
    if (!hasConsented) {
      setShowVoiceConsent(true);
      return;
    }
    voice.startRecording();
  }, [voice, hasConsented]);

  const handleVoiceConsent = useCallback(() => {
    setShowVoiceConsent(false);
    setHasConsented(true);
    voice.startRecording();
  }, [voice]);

  const handleVoiceDecline = useCallback(() => {
    setShowVoiceConsent(false);
  }, []);

  const handleEndEarly = useCallback(async () => {
    setShowEndDialog(false);
    await onEndEarly();
  }, [onEndEarly]);

  // ── Determine if we can resume ──────────────────────────────────────────────
  const hasResumableAttempt = state.messages.length > 0 && state.attemptId !== null;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderMessageContent = (msg: AssessmentMessage) => {
    const prefix = msg.teachingMoment ? '\u{1F4A1} ' : '';
    return prefix + msg.content;
  };

  // =========================================================================
  // PHASE: idle / resuming (loading)
  // =========================================================================

  if (state.phase === 'idle' || state.phase === 'resuming') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{TEXT.checking}</p>
      </div>
    );
  }

  // =========================================================================
  // PHASE: onboarding
  // =========================================================================

  if (state.phase === 'onboarding') {
    return (
      <div className={cn('flex flex-col items-center justify-center px-6 py-12 gap-6', className)}>
        {hasResumableAttempt ? (
          <>
            <MessageSquare className="h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {TEXT.resumeBanner}
            </p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Button onClick={() => onResumeAttempt(state.attemptId!)} className="w-full">
                {TEXT.resumeButton}
              </Button>
              <Button variant="outline" onClick={onAbandonAndRestart} className="w-full">
                {TEXT.startFresh}
              </Button>
            </div>
          </>
        ) : (
          <>
            <MessageSquare className="h-10 w-10 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{TEXT.onboardingTitle}</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {TEXT.onboardingDesc}
            </p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 shrink-0" />
                <span>{TEXT.voiceHint}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{TEXT.durationHint}</span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>{TEXT.quotaHint}</span>
              </div>
            </div>
            <Button onClick={onStartAssessment} className="w-full max-w-xs mt-2">
              {TEXT.startButton}
            </Button>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // PHASE: starting
  // =========================================================================

  if (state.phase === 'starting') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{TEXT.starting}</p>
      </div>
    );
  }

  // =========================================================================
  // PHASE: evaluating
  // =========================================================================

  if (state.phase === 'evaluating') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{TEXT.evaluating}</p>
      </div>
    );
  }

  // =========================================================================
  // PHASE: results
  // =========================================================================

  if (state.phase === 'results' && state.results) {
    return (
      <div className={cn('flex flex-col', className)}>
        {state.results.conversationSummary && (
          <p className="text-sm text-muted-foreground italic bg-muted/50 rounded-lg px-4 py-3 mx-4 mb-4">
            {state.results.conversationSummary}
          </p>
        )}
        <div className="px-4">
          <QuizResultsView
            results={{
              score: state.results.score,
              passed: state.results.passed,
              competencyLevel: state.results.competencyLevel,
              studentFeedback: state.results.studentFeedback,
            }}
            passingScore={passingScore}
            onRetry={onRetryAssessment}
            onContinue={onContinue}
            language={language}
          />
        </div>
      </div>
    );
  }

  // =========================================================================
  // PHASE: error
  // =========================================================================

  if (state.phase === 'error') {
    return (
      <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground text-center px-4">{state.error}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {TEXT.retry}
        </Button>
      </div>
    );
  }

  // =========================================================================
  // PHASE: conversing | sending | wrapping_up
  // =========================================================================

  const isConversing = state.phase === 'conversing' || state.phase === 'sending';
  const isWrappingUp = state.phase === 'wrapping_up';
  const isSending = state.phase === 'sending';
  const canSend = input.trim().length > 0 && !isSending;

  return (
    <div
      ref={chatContainerRef}
      className={cn(
        'flex flex-col h-full pb-[var(--kb-height,0px)]',
        className
      )}
      style={{ '--kb-height': '0px' } as React.CSSProperties}
    >
      {/* ── Header: Topic Progress + Menu ──────────────────────────────── */}
      <div className="flex items-center justify-between border-b bg-background">
        <TopicProgressBar
          covered={state.topicsCovered}
          total={state.topicsTotal}
          language={language}
          className="flex-1"
        />
        {(isConversing || isWrappingUp) && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mr-1"
            onClick={() => setShowEndDialog(true)}
            aria-label={TEXT.endAssessment}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* ── Chat Messages ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {state.messages
          .filter((msg) => msg.content !== '__WRAP_UP__')
          .map((msg, idx) => (
            <ChatBubble
              key={idx}
              role={msg.role}
              content={renderMessageContent(msg)}
              timestamp={new Date(msg.timestamp).toLocaleTimeString(isEs ? 'es' : 'en', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          ))}

        {isSending && (
          <div className="space-y-2">
            <LoadingDots />
            {waitMessage && (
              <p className="text-xs text-muted-foreground text-center animate-in fade-in duration-300">
                {waitMessage}
              </p>
            )}
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input Bar / Wrap-up Button ─────────────────────────────────── */}
      {isWrappingUp ? (
        <div className="border-t bg-background px-4 py-3">
          <Button onClick={onRequestEvaluation} className="w-full">
            {TEXT.viewResults}
          </Button>
        </div>
      ) : voice.isRecording ? (
        /* ── Recording UI ──────────────────────────────────────────────── */
        <div className="flex items-center gap-3 border-t bg-background px-4 py-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="text-sm font-medium text-foreground tabular-nums">
            {formatRecordingTime(voice.elapsedSeconds)}
          </span>
          <span className="text-xs text-muted-foreground flex-1">{TEXT.recording}</span>
          <Button
            variant="destructive"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => voice.stopRecording()}
          >
            <Square className="h-4 w-4" />
          </Button>
        </div>
      ) : voice.isTranscribing ? (
        /* ── Transcribing UI ───────────────────────────────────────────── */
        <div className="flex items-center justify-center gap-2 border-t bg-background px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{TEXT.transcribing}</span>
        </div>
      ) : (
        /* ── Normal Input Bar ──────────────────────────────────────────── */
        <div className="flex items-center gap-2 px-3 py-2 border-t bg-background">
          {canUseVoice && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={handleMicPress}
              disabled={isSending}
              aria-label={isEs ? 'Grabar voz' : 'Record voice'}
            >
              <Mic className="h-4 w-4" />
            </Button>
          )}
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={TEXT.inputPlaceholder}
            disabled={isSending}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={isEs ? 'Enviar' : 'Send'}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── Voice Error ────────────────────────────────────────────────── */}
      {voiceError && (
        <p className="text-xs text-destructive text-center px-4 pb-2">{voiceError}</p>
      )}

      {/* ── End Assessment Dialog ──────────────────────────────────────── */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{TEXT.endConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {TEXT.endConfirmDesc}
              {state.topicsTotal > 0 && (
                <>
                  {' '}
                  {isEs
                    ? `Has cubierto ${state.topicsCovered} de ${state.topicsTotal} temas.`
                    : `You've covered ${state.topicsCovered} of ${state.topicsTotal} topics.`}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{TEXT.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={handleEndEarly}>
              {TEXT.endAndEvaluate}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Voice Consent Dialog ───────────────────────────────────────── */}
      <VoiceConsentDialog
        open={showVoiceConsent}
        onConsent={handleVoiceConsent}
        onDecline={handleVoiceDecline}
        language={language}
      />
    </div>
  );
}
