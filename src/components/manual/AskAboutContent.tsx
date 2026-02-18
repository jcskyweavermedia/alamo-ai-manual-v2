/**
 * AskAboutContent
 *
 * Shared content for the contextual AI panel with integrated voice mode.
 * Supports both manual sections (original) and product items (Phase 7B).
 *
 * States:
 * - TEXT MODE: VoiceChatInput + empty/loading/answer states
 * - VOICE MODE: VoiceModeButton + VoiceTranscript (GPT-style inline)
 *
 * Product mode adds:
 * - TTS mode (auto-trigger, read aloud via /tts)
 * - Conversation mode (auto-connect WebRTC with product context)
 * - Chat mode (freeform text input with item context, no action sent)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, RotateCcw, Volume2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { VoiceChatInput } from '@/components/ui/voice-chat-input';
import { VoiceModeButton } from '@/components/ui/voice-mode-button';
import { AIAnswerCard } from '@/components/ui/ai-answer-card';
import { UsageMeter } from '@/components/ui/usage-meter';
import { VoiceTranscript } from './VoiceTranscript';
import { useAskAI, type Citation } from '@/hooks/use-ask-ai';
import { useUsageLimits } from '@/hooks/use-usage-limits';
import { useRealtimeWebRTC } from '@/hooks/use-realtime-webrtc';
import { useTTS } from '@/hooks/use-tts';
import type { AIActionConfig } from '@/data/ai-action-config';

// =============================================================================
// TYPES
// =============================================================================

type ContentState = 'empty' | 'loading' | 'answer';

interface AskAboutContentProps {
  // Manual mode props (optional when in product mode)
  /** Section slug for context */
  sectionId?: string;
  /** Section title for display and context */
  sectionTitle?: string;
  /** Called when user clicks a citation source */
  onNavigateToSection?: (slug: string) => void;

  // Product mode props
  /** Product domain (dishes, wines, cocktails, recipes, beer_liquor) */
  domain?: string;
  /** Action key (e.g. samplePitch, teachMe) */
  action?: string;
  /** Full item data for product context */
  itemContext?: Record<string, unknown>;
  /** Item display name */
  itemName?: string;
  /** Action config with mode/autoTrigger metadata */
  actionConfig?: AIActionConfig | null;

  // Shared
  /** Current language */
  language: 'en' | 'es';
  /** Whether voice mode is enabled for user */
  voiceEnabled?: boolean;
  /** Group ID for voice mode (required if voiceEnabled) */
  groupId?: string;
  /** Whether the panel is closing (for exit animation) */
  isClosing?: boolean;
  /** Optional className */
  className?: string;
}

// =============================================================================
// SAMPLE QUESTIONS (Category-Based) — manual mode only
// =============================================================================

const SAMPLE_QUESTIONS_MAP: Record<string, { en: string[]; es: string[] }> = {
  'food-safety': {
    en: ['What are the safe temperatures?', 'How often should I check?', 'What are the risks?'],
    es: ['¿Cuáles son las temperaturas seguras?', '¿Con qué frecuencia debo verificar?', '¿Cuáles son los riesgos?'],
  },
  'cleaning': {
    en: ['What products should I use?', 'How long does it take?', 'What is the procedure?'],
    es: ['¿Qué productos debo usar?', '¿Cuánto tiempo toma?', '¿Cuál es el procedimiento?'],
  },
  'temperature': {
    en: ['What is the correct range?', 'How do I calibrate?', 'What if it is out of range?'],
    es: ['¿Cuál es el rango correcto?', '¿Cómo calibro?', '¿Qué pasa si está fuera de rango?'],
  },
  'equipment': {
    en: ['How do I operate this?', 'What maintenance is required?', 'What safety precautions?'],
    es: ['¿Cómo lo opero?', '¿Qué mantenimiento requiere?', '¿Qué precauciones de seguridad?'],
  },
  'checklist': {
    en: ['What are the required steps?', 'How long does this take?', 'What if I miss something?'],
    es: ['¿Cuáles son los pasos requeridos?', '¿Cuánto tiempo toma?', '¿Qué pasa si omito algo?'],
  },
  'default': {
    en: ['What are the steps?', 'How often should I do this?', 'What should I check?'],
    es: ['¿Cuáles son los pasos?', '¿Con qué frecuencia debo hacer esto?', '¿Qué debo verificar?'],
  },
};

function getSampleQuestions(sectionTitle: string, sectionId: string, language: 'en' | 'es'): string[] {
  const searchText = `${sectionTitle} ${sectionId}`.toLowerCase();

  if (searchText.includes('temperature') || searchText.includes('temp') || searchText.includes('monitoring')) {
    return SAMPLE_QUESTIONS_MAP['temperature'][language];
  }
  if (searchText.includes('clean') || searchText.includes('sanit') || searchText.includes('wash')) {
    return SAMPLE_QUESTIONS_MAP['cleaning'][language];
  }
  if (searchText.includes('food') || searchText.includes('safety') || searchText.includes('contam')) {
    return SAMPLE_QUESTIONS_MAP['food-safety'][language];
  }
  if (searchText.includes('equipment') || searchText.includes('fryer') || searchText.includes('grill') || searchText.includes('oven')) {
    return SAMPLE_QUESTIONS_MAP['equipment'][language];
  }
  if (searchText.includes('checklist') || searchText.includes('opening') || searchText.includes('closing')) {
    return SAMPLE_QUESTIONS_MAP['checklist'][language];
  }

  return SAMPLE_QUESTIONS_MAP['default'][language];
}

// =============================================================================
// LOADING STAGES
// =============================================================================

const LOADING_STAGES = {
  searching: { en: 'Searching manual...', es: 'Buscando en el manual...' },
  writing: { en: 'Writing answer...', es: 'Escribiendo respuesta...' },
};

const PRODUCT_LOADING_STAGES = {
  searching: { en: 'Thinking...', es: 'Pensando...' },
  writing: { en: 'Writing answer...', es: 'Escribiendo respuesta...' },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function AskAboutContent({
  sectionId,
  sectionTitle,
  language,
  onNavigateToSection,
  voiceEnabled = false,
  groupId = '',
  isClosing = false,
  className,
  // Product mode props
  domain,
  action,
  itemContext,
  itemName,
  actionConfig,
}: AskAboutContentProps) {
  const isProductMode = !!domain;

  // Text mode state
  const [question, setQuestion] = useState('');
  const [contentState, setContentState] = useState<ContentState>('empty');
  const [loadingStage, setLoadingStage] = useState<'searching' | 'writing'>('searching');
  const [currentAnswer, setCurrentAnswer] = useState<{
    question: string;
    answer: string;
    citations: Citation[];
    isExpanding: boolean;
  } | null>(null);

  // Track which actionConfig key we've auto-triggered to prevent re-fires
  const autoTriggeredRef = useRef<string | null>(null);

  // Text AI hooks
  const { ask, isLoading } = useAskAI();
  const { data: usage, incrementUsageOptimistically, isAtLimit, isLoading: usageLoading } = useUsageLimits();

  // TTS hook (always called — React rules — harmless when idle)
  const tts = useTTS();

  // Voice mode hook — pass product context when in product mode
  const voiceHook = useRealtimeWebRTC({
    language,
    groupId,
    domain: isProductMode ? domain : undefined,
    action: isProductMode ? action : undefined,
    itemContext: isProductMode ? itemContext : undefined,
    listenOnly: actionConfig?.mode === 'voice-tts',
    skipGreeting: actionConfig?.noGreeting === true,
    onError: (err) => {
      console.error('[AskAboutContent] Voice error:', err);
    },
  });

  const isVoiceActive = voiceHook.state !== 'disconnected';

  // Track when a voice-tts pitch finishes (for post-pitch UI)
  const [pitchComplete, setPitchComplete] = useState(false);

  // Labels — adapt for product mode
  const labels = {
    placeholder: isProductMode
      ? (language === 'es'
        ? `Pregunta sobre "${itemName}"...`
        : `Ask about "${itemName}"...`)
      : (language === 'es'
        ? `Pregunta sobre "${sectionTitle}"...`
        : `Ask about "${sectionTitle}"...`),
    emptyPrompt: isProductMode
      ? (language === 'es'
        ? `¿Qué quieres saber sobre ${itemName}?`
        : `What would you like to know about ${itemName}?`)
      : (language === 'es'
        ? '¿Qué quieres saber sobre esta sección?'
        : 'What would you like to know about this section?'),
    usageLabel: language === 'es' ? 'restantes hoy' : 'remaining today',
    limitReached: language === 'es'
      ? 'Has alcanzado tu límite diario.'
      : 'You have reached your daily limit.',
    newQuestion: language === 'es' ? 'Nueva pregunta' : 'New question',
    voiceActive: language === 'es' ? 'Modo voz activo' : 'Voice mode active',
  };

  // Stage-based loading progression
  useEffect(() => {
    if (contentState === 'loading') {
      setLoadingStage('searching');
      const timer = setTimeout(() => {
        setLoadingStage('writing');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [contentState]);

  // Auto-trigger for product mode actions (tts + conversation)
  useEffect(() => {
    if (!actionConfig?.autoTrigger) return;
    if (autoTriggeredRef.current === actionConfig.key) return;

    autoTriggeredRef.current = actionConfig.key;
    const mode = actionConfig.mode;
    let cancelled = false;

    if (mode === 'tts') {
      // Auto-call ask() with action, then auto-play TTS
      setContentState('loading');
      ask(actionConfig.label, { domain, action: actionConfig.key, itemContext })
        .then(result => {
          if (cancelled) return;
          if (result) {
            incrementUsageOptimistically();
            setCurrentAnswer({
              question: language === 'es' ? actionConfig.labelEs : actionConfig.label,
              answer: result.answer,
              citations: result.citations,
              isExpanding: false,
            });
            setContentState('answer');
            tts.speak(result.answer);
          } else {
            setContentState('empty');
          }
        });
    } else if (mode === 'voice-tts') {
      // Listen-only Realtime API — AI speaks the pitch, no mic
      voiceHook.connect();
    } else if (mode === 'conversation') {
      // Auto-connect WebRTC (voice hook already has product context)
      voiceHook.connect();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionConfig?.key]);

  // Stop TTS on unmount
  useEffect(() => {
    return () => {
      tts.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect voice-tts pitch completion
  useEffect(() => {
    if (actionConfig?.mode === 'voice-tts' && voiceHook.state === 'disconnected' && voiceHook.transcript.length > 0) {
      setPitchComplete(true);
    }
  }, [voiceHook.state, voiceHook.transcript.length, actionConfig?.mode]);

  // Handle question submission (text mode)
  const handleSubmit = useCallback(async () => {
    if (!question.trim() || isLoading || isAtLimit) return;

    const askedQuestion = question;

    setQuestion('');
    setContentState('loading');

    // Branch: product mode uses domain + itemContext (search mode, no action)
    // Manual mode uses sectionId/sectionTitle context
    const result = isProductMode
      ? await ask(askedQuestion, { domain, itemContext })
      : await ask(askedQuestion, { context: { sectionId, sectionTitle } });

    if (result) {
      incrementUsageOptimistically();
      setCurrentAnswer({
        question: askedQuestion,
        answer: result.answer,
        citations: result.citations,
        isExpanding: false,
      });
      setContentState('answer');
    } else {
      setContentState('empty');
    }
  }, [question, isLoading, isAtLimit, isProductMode, domain, itemContext, sectionId, sectionTitle, ask, incrementUsageOptimistically]);

  // Handle expand answer
  const handleExpandAnswer = useCallback(async () => {
    if (!currentAnswer || currentAnswer.isExpanding) return;

    setCurrentAnswer(prev => prev ? { ...prev, isExpanding: true } : null);

    const result = isProductMode
      ? await ask(currentAnswer.question, { expand: true, domain, itemContext })
      : await ask(currentAnswer.question, { expand: true, context: { sectionId, sectionTitle } });

    if (result) {
      setCurrentAnswer(prev => prev ? {
        ...prev,
        answer: result.answer,
        citations: result.citations,
        isExpanding: false,
      } : null);
    } else {
      setCurrentAnswer(prev => prev ? { ...prev, isExpanding: false } : null);
    }
  }, [currentAnswer, isProductMode, domain, itemContext, sectionId, sectionTitle, ask]);

  // Handle source click
  const handleSourceClick = useCallback((source: { id: string; sectionId?: string }) => {
    if (source.sectionId && onNavigateToSection) {
      onNavigateToSection(source.sectionId);
    }
  }, [onNavigateToSection]);

  // Handle new question / reset
  const handleReset = useCallback(() => {
    tts.stop();
    setCurrentAnswer(null);
    setContentState('empty');
    setQuestion('');
  }, [tts]);

  // Voice mode handlers
  const handleVoiceConnect = useCallback(() => {
    if (groupId) {
      voiceHook.connect();
    }
  }, [groupId, voiceHook]);

  const handleVoiceDisconnect = useCallback(() => {
    voiceHook.disconnect();
  }, [voiceHook]);

  // Map citations to AISource format
  const mapCitationsToSources = (citations: Citation[]) =>
    citations.map(c => ({
      id: c.id,
      label: c.title,
      sectionId: c.slug,
    }));

  // Sample questions for empty state (manual mode only)
  const sampleQuestions = !isProductMode && sectionTitle && sectionId
    ? getSampleQuestions(sectionTitle, sectionId, language)
    : [];

  const loadingStages = isProductMode ? PRODUCT_LOADING_STAGES : LOADING_STAGES;

  return (
    <div
      className={cn(
        'flex flex-col h-full pr-4',
        isClosing
          ? 'animate-out slide-out-to-right-2 fade-out-0 duration-500 ease-in'
          : 'animate-in slide-in-from-right-2 fade-in-0 duration-500 ease-out',
        className
      )}
    >
      {/* Usage Meter */}
      <div className="px-4 py-3 border-b border-border">
        <UsageMeter
          used={usage.daily.used}
          total={usage.daily.limit}
          label={labels.usageLabel}
          isLoading={usageLoading}
        />
      </div>

      {/* Input Area - switches between text and voice mode */}
      {/* Hide input for voice-tts mode (no mic, no text input needed) */}
      {actionConfig?.mode !== 'voice-tts' && (
        <div className="px-4 py-3 border-b border-border">
          {isVoiceActive ? (
            // Voice mode: show VoiceModeButton only
            <div className="flex items-center gap-3">
              <VoiceModeButton
                state={voiceHook.state}
                onConnect={handleVoiceConnect}
                onDisconnect={handleVoiceDisconnect}
                disabled={!voiceEnabled || !groupId}
                language={language}
              />
              <span className="text-sm text-muted-foreground flex-1">
                {labels.voiceActive}
              </span>
            </div>
          ) : (
            // Text mode: show VoiceChatInput with voice toggle
            <>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <VoiceChatInput
                    value={question}
                    onChange={setQuestion}
                    onSubmit={handleSubmit}
                    placeholder={labels.placeholder}
                    disabled={isAtLimit}
                    isLoading={isLoading}
                    language={language}
                    voiceEnabled={false} // Disable built-in voice mode button
                  />
                </div>
                {/* Separate voice mode toggle */}
                {voiceEnabled && groupId && (
                  <VoiceModeButton
                    state={voiceHook.state}
                    onConnect={handleVoiceConnect}
                    onDisconnect={handleVoiceDisconnect}
                    disabled={isAtLimit}
                    language={language}
                  />
                )}
              </div>
              {isAtLimit && (
                <p className="text-small text-destructive mt-sm">
                  {labels.limitReached}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Voice Mode: Show transcript */}
        {isVoiceActive ? (
          <VoiceTranscript
            entries={voiceHook.transcript}
            maxEntries={actionConfig?.mode === 'voice-tts' ? 1 : 5}
            language={language}
            className="h-full"
          />
        ) : pitchComplete && actionConfig?.mode === 'voice-tts' ? (
          /* Voice-TTS complete: show transcript + listen again */
          <div className="flex flex-col items-center justify-center py-xl text-center h-full min-h-[200px]">
            <VoiceTranscript
              entries={voiceHook.transcript}
              maxEntries={1}
              language={language}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPitchComplete(false);
                voiceHook.connect();
              }}
              className="mt-4"
            >
              <RotateCcw className="h-4 w-4 mr-xs" />
              {language === 'es' ? 'Escuchar de nuevo' : 'Listen again'}
            </Button>
          </div>
        ) : (
          <>
            {/* Text Mode: Empty State */}
            {contentState === 'empty' && (
              <div className="flex flex-col items-center justify-center py-xl text-center h-full min-h-[200px]">
                <Sparkles className="h-12 w-12 text-primary/30 mb-md" />
                <p className="text-body text-muted-foreground mb-lg">
                  {labels.emptyPrompt}
                </p>
                {/* Sample questions only in manual mode */}
                {sampleQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-sm justify-center">
                    {sampleQuestions.map((q) => (
                      <Button
                        key={q}
                        variant="outline"
                        size="sm"
                        onClick={() => setQuestion(q)}
                        disabled={isAtLimit}
                        className="text-left h-auto py-2"
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Text Mode: Loading State */}
            {contentState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-xl text-center h-full min-h-[200px]">
                <div className="relative mb-md">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <p className="text-body text-muted-foreground">
                  {loadingStages[loadingStage][language]}
                </p>
              </div>
            )}

            {/* Text Mode: Answer State */}
            {contentState === 'answer' && currentAnswer && (
              <div className="space-y-md">
                <AIAnswerCard
                  question={currentAnswer.question}
                  answer={currentAnswer.answer}
                  isLoading={false}
                  isExpanding={currentAnswer.isExpanding}
                  sources={mapCitationsToSources(currentAnswer.citations)}
                  onSourceClick={handleSourceClick}
                  onExpand={handleExpandAnswer}
                />

                {/* TTS audio indicator (product mode only) */}
                {isProductMode && tts.isGenerating && (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                    <Volume2 className="h-4 w-4 animate-pulse" />
                    <span>{language === 'es' ? 'Generando audio...' : 'Generating audio...'}</span>
                  </div>
                )}
                {isProductMode && tts.isPlaying && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <Volume2 className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-sm text-muted-foreground">
                      {language === 'es' ? 'Reproduciendo...' : 'Playing...'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={tts.stop}
                      className="h-7 px-2"
                    >
                      <Square className="h-3 w-3 mr-1" />
                      {language === 'es' ? 'Detener' : 'Stop'}
                    </Button>
                  </div>
                )}

                {/* New Question Button */}
                <div className="flex justify-center pt-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-muted-foreground"
                  >
                    <RotateCcw className="h-4 w-4 mr-xs" />
                    {labels.newQuestion}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
