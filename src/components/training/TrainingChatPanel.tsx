import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, RotateCcw, AudioWaveform, Square, X } from 'lucide-react';
import { BsMicFill, BsChatDotsFill } from 'react-icons/bs';
import { RiUserVoiceFill } from 'react-icons/ri';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChatBubble } from './ChatBubble';
import { SuggestedReplyChips } from './SuggestedReplyChips';
import { ProgressStrip } from './ProgressStrip';
import { TutorModeCard } from './TutorModeCard';
import { useVoiceRecording } from '@/hooks/use-voice-recording';
import { useRealtimeWebRTC, type WebRTCVoiceState } from '@/hooks/use-realtime-webrtc';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import type { ConversationMessage, ChatItem, SessionDividerItem } from '@/types/training';

type SectionMode = 'quiz_me' | 'teach_me' | 'ask_anything';

interface TrainingChatPanelProps {
  sectionTitle: string;
  chatItems: ChatItem[];
  suggestedReplies: string[];
  topicsCovered: string[];
  topicsTotal: string[];
  shouldSuggestQuiz?: boolean;
  isSending: boolean;
  isLoadingHistory?: boolean;
  hasHistory: boolean;
  onSendMessage: (text: string) => void;
  onStartNewSession: (modeLabel?: string) => void;
  onResumeLatest: () => void;
  onStartQuiz?: () => void;
  onVoiceMode?: () => void;
  voiceEnabled?: boolean;
  language: 'en' | 'es';
  /** Externally trigger a mode (e.g. from a navbar button). Set to null after handled. */
  pendingMode?: SectionMode | null;
  onPendingModeConsumed?: () => void;
  /** AI teacher slug — enables Live Trainer voice mode */
  teacherSlug?: string | null;
  /** Section ID — used for voice context enrichment */
  sectionId?: string;
  /** Append a voice transcript message to the conversation */
  appendVoiceMessage?: (entry: { role: 'user' | 'assistant'; content: string; timestamp: string }) => void;
  /** Called whenever voice state changes — used by parent to show floating button */
  onVoiceStateChange?: (
    state: WebRTCVoiceState | 'disconnected',
    controls: { disconnect: () => void; interruptAndAsk: () => void }
  ) => void;
  /** Auto-disconnect after this many ms of inactivity in voice mode (default 60000) */
  voiceInactivityTimeoutMs?: number;
  className?: string;
}

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

function SessionDivider({
  label,
  timestamp,
  language,
}: {
  label: string;
  timestamp: string;
  language: 'en' | 'es';
}) {
  const formatted = new Date(timestamp).toLocaleDateString(
    language === 'es' ? 'es' : 'en',
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  );
  return (
    <div className="flex items-center gap-2 py-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground whitespace-nowrap px-1">
        {label} · {formatted}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

const MODE_LABELS: Record<SectionMode, { en: string; es: string; emoji: string }> = {
  quiz_me:      { en: 'Practice', es: 'Práctica', emoji: '🧠' },
  teach_me:     { en: 'Teach',    es: 'Enséñame', emoji: '📖' },
  ask_anything: { en: 'Ask',      es: 'Preg.',    emoji: '💬' },
};

const VOICE_STATUS_STRINGS = {
  en: {
    connecting: 'Connecting to Live Trainer...',
    connected:  'Live Trainer ready',
    listening:  'Listening...',
    processing: 'Thinking...',
    speaking:   'Trainer is speaking',
  },
  es: {
    connecting: 'Conectando con Entrenador...',
    connected:  'Entrenador listo',
    listening:  'Escuchando...',
    processing: 'Pensando...',
    speaking:   'El entrenador habla',
  },
} as const;

function VoiceStatusStrip({
  state,
  language,
}: {
  state: WebRTCVoiceState;
  language: 'en' | 'es';
}) {
  const strings = VOICE_STATUS_STRINGS[language];
  const label = strings[state as keyof typeof strings] ?? strings.connected;

  const dotClass = (
    {
      connecting: 'bg-orange-300 animate-pulse',
      connected:  'bg-green-400',
      listening:  'bg-orange-500 animate-pulse',
      processing: 'bg-orange-400 animate-pulse-subtle',
      speaking:   'bg-orange-600 animate-pulse',
    } as Record<string, string>
  )[state] ?? 'bg-orange-400';

  return (
    <div className="border-t bg-orange-50 dark:bg-orange-950/20 px-4 py-2 flex items-center gap-2 shrink-0">
      <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
      <span className="text-xs text-orange-700 dark:text-orange-300">{label}</span>
    </div>
  );
}

function VoiceControlBar({
  state,
  language,
  onInterrupt,
  onEnd,
}: {
  state: WebRTCVoiceState;
  language: 'en' | 'es';
  onInterrupt: () => void;
  onEnd: () => void;
}) {
  const isEs = language === 'es';
  const isSpeaking = state === 'speaking';

  const label =
    state === 'connecting'  ? (isEs ? 'Conectando...'             : 'Connecting...')
    : state === 'connected'   ? (isEs ? 'Habla cuando quieras'        : 'Speak to ask anything')
    : state === 'listening'   ? (isEs ? 'Escuchando...'               : 'Listening...')
    : state === 'processing'  ? (isEs ? 'Pensando...'                 : 'Thinking...')
    : state === 'speaking'    ? (isEs ? '✋ Interrumpir y Preguntar'  : '✋ Interrupt & Ask')
    : '';

  const leftIcon =
    state === 'connecting'  ? <Loader2 className="h-4 w-4 animate-spin shrink-0" />
    : state === 'listening'   ? (
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
        </span>
      )
    : <AudioWaveform className={cn(
        'h-4 w-4 shrink-0',
        (state === 'speaking' || state === 'connected') && 'text-current',
        state === 'processing' && 'animate-pulse-subtle',
        state === 'speaking'  && 'animate-pulse',
      )} />;

  return (
    <div className="px-3 py-3 border-t shrink-0">
      <div className="flex items-center gap-1">
        {/* Main action area */}
        <button
          type="button"
          onClick={isSpeaking ? onInterrupt : undefined}
          disabled={!isSpeaking}
          className={cn(
            'flex-1 h-11 rounded-2xl flex items-center justify-center gap-2.5',
            'text-sm font-medium transition-all duration-200',
            isSpeaking
              ? [
                  'bg-orange-500 text-white cursor-pointer',
                  'shadow-[0_0_18px_rgba(249,115,22,0.55)]',
                  'animate-pulse hover:bg-orange-600 active:bg-orange-700',
                ].join(' ')
              : 'bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 cursor-default',
          )}
        >
          {leftIcon}
          <span>{label}</span>
        </button>

        {/* End session button */}
        <button
          type="button"
          onClick={onEnd}
          title={isEs ? 'Terminar sesión' : 'End session'}
          className="shrink-0 flex items-center justify-center w-10 h-11 rounded-2xl
                     text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TrainingChatPanel({
  sectionTitle,
  chatItems,
  suggestedReplies,
  topicsCovered,
  topicsTotal,
  shouldSuggestQuiz = false,
  isSending,
  isLoadingHistory = false,
  hasHistory,
  onSendMessage,
  onStartNewSession,
  onResumeLatest,
  onStartQuiz,
  onVoiceMode,
  voiceEnabled = false,
  language,
  pendingMode,
  onPendingModeConsumed,
  teacherSlug,
  sectionId,
  appendVoiceMessage,
  onVoiceStateChange,
  voiceInactivityTimeoutMs,
  className,
}: TrainingChatPanelProps) {
  // Panel is always the entry point
  const [showPanel, setShowPanel] = useState(true);
  const [selectedMode, setSelectedMode] = useState<SectionMode | null>(null);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const isEs = language === 'es';

  const { permissions } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? '';

  const voiceControlsRef = useRef<{ disconnect: () => void; interruptAndAsk: () => void }>(
    { disconnect: () => {}, interruptAndAsk: () => {} }
  );

  const voiceRec = useVoiceRecording({
    language,
    onTranscription: (text) => {
      if (text.trim()) {
        onSendMessage(text.trim());
      }
    },
  });

  // Live Trainer voice hook — only active when teacherSlug is available
  const voiceHook = useRealtimeWebRTC({
    language,
    groupId,
    teacher_slug: teacherSlug ?? undefined,
    section_id: sectionId,
    inactivityTimeoutMs: teacherSlug ? (voiceInactivityTimeoutMs ?? 60_000) : 0,
    inactivityWarningMs: 15_000,
    onInactivityWarning: (sec) => toast({
      title: language === 'es' ? 'Sesión inactiva' : 'Inactive session',
      description: language === 'es' ? `La sesión cerrará en ${sec}s` : `Session closes in ${sec}s`,
    }),
    onStateChange: (newState) => {
      onVoiceStateChange?.(newState, voiceControlsRef.current);
    },
    onTranscript: (entry) => {
      appendVoiceMessage?.({
        role: entry.role,
        content: entry.text,
        timestamp: new Date(entry.timestamp).toISOString(),
      });
    },
    onError: (err) => {
      console.error('[TrainingChatPanel] Voice error:', err);
    },
  });

  // Keep voiceControlsRef in sync with latest hook functions
  useEffect(() => {
    voiceControlsRef.current = {
      disconnect: voiceHook.disconnect,
      interruptAndAsk: voiceHook.interruptAndAsk,
    };
  }, [voiceHook.disconnect, voiceHook.interruptAndAsk]);

  // Propagate disconnected state to parent (covers cleanup/unmount paths)
  useEffect(() => {
    if (voiceHook.state === 'disconnected') {
      onVoiceStateChange?.('disconnected', voiceControlsRef.current);
    }
  }, [voiceHook.state, onVoiceStateChange]);

  const isVoiceActive = voiceHook.state !== 'disconnected';
  const showSend = input.trim().length > 0 || isFocused;

  // Scroll to bottom when chat items change or sending state changes
  useEffect(() => {
    if (scrollRef.current && !showPanel) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatItems, isSending, showPanel]);

  // External trigger — e.g. navbar "Practice Quiz" button
  useEffect(() => {
    if (pendingMode) {
      handleSelectMode(pendingMode);
      onPendingModeConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMode]);

  const handleSend = () => {
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectMode = (mode: SectionMode) => {
    setSelectedMode(mode);

    const modeLabels = {
      quiz_me:      { en: 'Practice Quiz',  es: 'Práctica de Quiz' },
      teach_me:     { en: 'Teach Me',       es: 'Enséñame' },
      ask_anything: { en: 'Ask Anything',   es: 'Pregunta Libre' },
    };
    const modeLabel = isEs ? modeLabels[mode].es : modeLabels[mode].en;

    onStartNewSession(modeLabel);
    setShowPanel(false);

    if (mode === 'quiz_me') {
      onSendMessage(isEs ? `Evalúame sobre ${sectionTitle}` : `Quiz me on ${sectionTitle}`);
    } else if (mode === 'teach_me') {
      onSendMessage(isEs ? `Enséñame sobre ${sectionTitle}` : `Teach me about ${sectionTitle}`);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleResume = () => {
    onResumeLatest();
    setShowPanel(false);
    setSelectedMode(null);
  };

  // ✕ badge — go back to panel without wiping history
  const handleResetMode = () => {
    setShowPanel(true);
  };

  // Live Trainer: switch to chat view + connect voice (no initial text message)
  const handleLiveTrainer = (mode: SectionMode) => {
    setSelectedMode(mode);
    const modeLabel = isEs ? 'Entrenador en Vivo' : 'Live Trainer';
    onStartNewSession(modeLabel);
    setShowPanel(false);
    voiceHook.connect();
  };

  const modeActions = (mode: SectionMode) => [
    {
      icon: <RiUserVoiceFill className="h-3.5 w-3.5" />,
      label: isEs ? 'Entrenador en Vivo' : 'Live Trainer',
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        handleLiveTrainer(mode);
      },
    },
    {
      icon: <BsChatDotsFill className="h-3.5 w-3.5" />,
      label: isEs ? 'Chat' : 'Chat',
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        handleSelectMode(mode);
      },
    },
  ];

  const activeModeLabel = selectedMode ? MODE_LABELS[selectedMode] : null;

  // Count only actual messages (not dividers) for suggested replies
  const messageCount = chatItems.filter(
    (item): item is ConversationMessage => !('type' in item)
  ).length;

  const inputPlaceholder = isEs ? 'Escribe aquí...' : 'Type here...';

  // --------------------------------------------------------------------------
  // PANEL VIEW (entry point — showPanel === true)
  // --------------------------------------------------------------------------
  if (showPanel) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <img
            src="/images/tastly-isotope.svg"
            className="h-5 w-5 shrink-0"
            alt="Tastly"
          />
          <h3 className="text-sm font-semibold flex-1 truncate">
            {isEs ? 'Maestro IA' : 'AI Teacher'}
          </h3>
        </div>

        {/* Scrollable body — vertically centered */}
        <div className="flex-1 overflow-y-auto px-4">
          <div className="min-h-full flex flex-col justify-center py-6">
          {/* Hero / tagline */}
          <div className="flex flex-col items-center gap-1 text-center pb-5">
            <span className="text-6xl">🎓</span>
            <h4 className="text-sm font-semibold text-foreground mt-2">
              {isEs ? 'Maestro IA' : 'AI Teacher'}
            </h4>
            <p className="text-xs text-muted-foreground">
              {hasHistory
                ? (isEs ? 'Elige tu modo de aprendizaje' : 'Choose your learning mode')
                : (isEs ? '¿Cómo quieres aprender hoy?' : 'How do you want to learn today?')}
            </p>
          </div>

          {/* Mode cards */}
          <div className="space-y-2 max-w-xs mx-auto w-full">
            <TutorModeCard
              emoji="📖"
              title={isEs ? 'Enséñame' : 'Teach Me'}
              description={
                isEs
                  ? 'Repasa los conceptos clave paso a paso'
                  : 'Walk through key concepts step by step'
              }
              actions={modeActions('teach_me')}
            />
            <TutorModeCard
              emoji="🧠"
              title={isEs ? 'Preguntas de Práctica' : 'Practice Questions'}
              description={
                isEs
                  ? 'Pon a prueba tus conocimientos con el tutor'
                  : 'Test yourself with guided tutor feedback'
              }
              actions={modeActions('quiz_me')}
            />

            {/* Resume button — only shown when history exists */}
            {hasHistory && !isLoadingHistory && (
              <Button
                variant="outline"
                className="w-full mt-2 gap-2 text-muted-foreground"
                onClick={handleResume}
              >
                <RotateCcw className="h-4 w-4" />
                {isEs ? 'Continuar donde lo dejé' : 'Resume where I left off'}
              </Button>
            )}

            {/* Loading indicator while checking for history */}
            {isLoadingHistory && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // CHAT VIEW (showPanel === false)
  // --------------------------------------------------------------------------
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <img
          src="/images/tastly-isotope.svg"
          className="h-5 w-5 shrink-0"
          alt="Tastly"
        />
        <h3 className="text-sm font-semibold flex-1 truncate">
          {isEs ? 'Maestro IA' : 'AI Teacher'}
        </h3>

        {/* Active mode badge — tap to go back to panel (does NOT wipe history) */}
        {activeModeLabel && (
          <button
            type="button"
            onClick={handleResetMode}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors shrink-0"
            title={isEs ? 'Cambiar modo' : 'Change mode'}
          >
            <span>{activeModeLabel.emoji}</span>
            <span>{isEs ? activeModeLabel.es : activeModeLabel.en}</span>
            <span className="opacity-50 ml-0.5">✕</span>
          </button>
        )}

        {/* Fallback reset button when no mode is selected (resumed session) */}
        {!activeModeLabel && (
          <button
            type="button"
            onClick={handleResetMode}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors shrink-0"
            title={isEs ? 'Cambiar modo' : 'Change mode'}
          >
            <span className="opacity-50">✕</span>
          </button>
        )}
      </div>

      {/* Progress strip */}
      {topicsTotal.length > 0 && (
        <div className="px-4 py-2 border-b shrink-0">
          <ProgressStrip
            covered={topicsCovered.length}
            total={topicsTotal.length}
            language={language}
          />
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {/* Loading history */}
        {isLoadingHistory && chatItems.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
          </div>
        )}

        {/* Render chat items: session dividers + messages */}
        {chatItems.map((item, i) => {
          if ('type' in item && item.type === 'session_divider') {
            const divider = item as SessionDividerItem;
            return (
              <SessionDivider
                key={`divider-${i}-${divider.timestamp}`}
                label={divider.label}
                timestamp={divider.timestamp}
                language={language}
              />
            );
          }
          const msg = item as ConversationMessage;
          return (
            <ChatBubble
              key={`msg-${i}-${msg.timestamp}`}
              role={msg.role}
              content={msg.content}
              timestamp={new Date(msg.timestamp).toLocaleTimeString(
                isEs ? 'es' : 'en',
                { hour: '2-digit', minute: '2-digit' }
              )}
            />
          );
        })}

        {isSending && <LoadingDots />}

        {!isSending && suggestedReplies.length > 0 && messageCount > 0 && (
          <SuggestedReplyChips
            chips={suggestedReplies}
            onSelect={(chip) => onSendMessage(chip)}
            disabled={isSending}
          />
        )}

        {shouldSuggestQuiz && onStartQuiz && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              className="text-green-600 border-green-300 hover:bg-green-50"
              onClick={onStartQuiz}
            >
              {isEs ? '¿Listo para el quiz?' : 'Ready for the quiz?'}
            </Button>
          </div>
        )}
      </div>

      {/* Input area: voice control bar when active, normal pill otherwise */}
      {isVoiceActive ? (
        <VoiceControlBar
          state={voiceHook.state}
          language={language}
          onInterrupt={voiceHook.interruptAndAsk}
          onEnd={voiceHook.disconnect}
        />
      ) : (
        <div className="px-4 py-3 border-t shrink-0">
          <div className="flex items-center rounded-2xl border border-input bg-background px-2 py-1 gap-1">

            {/* Native input — flex-1, transparent, no border */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                voiceRec.isRecording
                  ? (isEs ? 'Grabando...' : 'Recording...')
                  : voiceRec.isTranscribing
                    ? (isEs ? 'Transcribiendo...' : 'Transcribing...')
                    : inputPlaceholder
              }
              disabled={isSending || voiceRec.isRecording || voiceRec.isTranscribing}
              className={cn(
                'flex-1 min-w-0 bg-transparent border-none outline-none',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'disabled:cursor-not-allowed disabled:opacity-50 py-1.5 px-1'
              )}
            />

            {/* STT Mic */}
            <button
              type="button"
              onClick={() => {
                if (voiceRec.isRecording) voiceRec.stopRecording();
                else if (!voiceRec.isTranscribing) voiceRec.startRecording();
              }}
              disabled={isSending || voiceRec.isTranscribing}
              title={voiceRec.isRecording ? (isEs ? 'Detener' : 'Stop') : (isEs ? 'Voz a texto' : 'Voice to text')}
              className={cn(
                'shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                'disabled:pointer-events-none disabled:opacity-50',
                voiceRec.isRecording
                  ? 'bg-destructive/10 text-destructive animate-pulse'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {voiceRec.isTranscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : voiceRec.isRecording ? (
                <Square className="h-3.5 w-3.5" />
              ) : (
                <BsMicFill className="h-4 w-4" />
              )}
            </button>

            {/* RIGHT: send | waveform start */}
            {showSend ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                title={isEs ? 'Enviar' : 'Send'}
                className={cn(
                  'shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                  'bg-orange-500 text-white hover:bg-orange-600',
                  'disabled:opacity-40 disabled:pointer-events-none'
                )}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            ) : teacherSlug && groupId ? (
              <button
                type="button"
                onClick={voiceHook.connect}
                disabled={isSending || voiceRec.isRecording || voiceRec.isTranscribing}
                title={isEs ? 'Iniciar voz en vivo' : 'Start live voice'}
                className={cn(
                  'shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                  'bg-orange-500 text-white hover:bg-orange-600',
                  'disabled:opacity-40 disabled:pointer-events-none'
                )}
              >
                <AudioWaveform className="h-4 w-4" />
              </button>
            ) : voiceEnabled && onVoiceMode ? (
              <button
                type="button"
                onClick={onVoiceMode}
                disabled={isSending || voiceRec.isRecording || voiceRec.isTranscribing}
                title={isEs ? 'Conversación en vivo' : 'Live voice'}
                className={cn(
                  'shrink-0 flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                  'bg-foreground text-background hover:bg-foreground/80',
                  'disabled:opacity-40 disabled:pointer-events-none'
                )}
              >
                <AudioWaveform className="h-4 w-4" />
              </button>
            ) : null}

          </div>
        </div>
      )}
    </div>
  );
}
