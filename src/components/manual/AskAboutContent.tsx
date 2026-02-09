/**
 * AskAboutContent
 * 
 * Shared content for the contextual AI panel with integrated voice mode.
 * 
 * States:
 * - TEXT MODE: VoiceChatInput + empty/loading/answer states
 * - VOICE MODE: VoiceModeButton + VoiceTranscript (GPT-style inline)
 * 
 * Part of Step 11: Integrated Voice Chat Mode
 */

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
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

// =============================================================================
// TYPES
// =============================================================================

type ContentState = 'empty' | 'loading' | 'answer';

interface AskAboutContentProps {
  /** Section slug for context */
  sectionId: string;
  /** Section title for display and context */
  sectionTitle: string;
  /** Current language */
  language: 'en' | 'es';
  /** Called when user clicks a citation source */
  onNavigateToSection: (slug: string) => void;
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
// SAMPLE QUESTIONS (Category-Based)
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
}: AskAboutContentProps) {
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

  // Text AI hooks
  const { ask, isLoading } = useAskAI();
  const { data: usage, incrementUsageOptimistically, isAtLimit, isLoading: usageLoading } = useUsageLimits();

  // Voice mode hook - only initialize if enabled
  const voiceHook = useRealtimeWebRTC({
    language,
    groupId,
    onError: (err) => {
      console.error('[AskAboutContent] Voice error:', err);
    },
  });

  const isVoiceActive = voiceHook.state !== 'disconnected';

  // Labels
  const labels = {
    placeholder: language === 'es' 
      ? `Pregunta sobre "${sectionTitle}"...`
      : `Ask about "${sectionTitle}"...`,
    emptyPrompt: language === 'es'
      ? '¿Qué quieres saber sobre esta sección?'
      : 'What would you like to know about this section?',
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

  // Handle question submission (text mode)
  const handleSubmit = useCallback(async () => {
    if (!question.trim() || isLoading || isAtLimit) return;

    const askedQuestion = question;
    
    setQuestion('');
    setContentState('loading');

    const result = await ask(askedQuestion, { context: { sectionId, sectionTitle } });

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
  }, [question, isLoading, isAtLimit, sectionId, sectionTitle, ask, incrementUsageOptimistically]);

  // Handle expand answer
  const handleExpandAnswer = useCallback(async () => {
    if (!currentAnswer || currentAnswer.isExpanding) return;

    setCurrentAnswer(prev => prev ? { ...prev, isExpanding: true } : null);

    const result = await ask(currentAnswer.question, { expand: true, context: { sectionId, sectionTitle } });

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
  }, [currentAnswer, sectionId, sectionTitle, ask]);

  // Handle source click
  const handleSourceClick = useCallback((source: { id: string; sectionId?: string }) => {
    if (source.sectionId) {
      onNavigateToSection(source.sectionId);
    }
  }, [onNavigateToSection]);

  // Handle new question / reset
  const handleReset = useCallback(() => {
    setCurrentAnswer(null);
    setContentState('empty');
    setQuestion('');
  }, []);

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

  // Sample questions for empty state
  const sampleQuestions = getSampleQuestions(sectionTitle, sectionId, language);

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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Voice Mode: Show transcript */}
        {isVoiceActive ? (
          <VoiceTranscript
            entries={voiceHook.transcript}
            maxEntries={5}
            language={language}
            className="h-full"
          />
        ) : (
          <>
            {/* Text Mode: Empty State */}
            {contentState === 'empty' && (
              <div className="flex flex-col items-center justify-center py-xl text-center h-full min-h-[200px]">
                <Sparkles className="h-12 w-12 text-primary/30 mb-md" />
                <p className="text-body text-muted-foreground mb-lg">
                  {labels.emptyPrompt}
                </p>
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
              </div>
            )}

            {/* Text Mode: Loading State */}
            {contentState === 'loading' && (
              <div className="flex flex-col items-center justify-center py-xl text-center h-full min-h-[200px]">
                <div className="relative mb-md">
                  <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <p className="text-body text-muted-foreground">
                  {LOADING_STAGES[loadingStage][language]}
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
                  onFeedback={(type) => console.log('Feedback:', type)}
                />
                
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
