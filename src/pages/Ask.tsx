import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { PageTitle, MetaText } from "@/components/ui/typography";
import { AIAnswerCard } from "@/components/ui/ai-answer-card";
import { UsageMeter } from "@/components/ui/usage-meter";
import { Card, CardContent } from "@/components/ui/card";
import { VoiceChatInput } from "@/components/ui/voice-chat-input";
import { VoiceModeButton } from "@/components/ui/voice-mode-button";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAskAI, type Citation } from "@/hooks/use-ask-ai";
import { useUsageLimits } from "@/hooks/use-usage-limits";
import { useAuth } from "@/hooks/use-auth";
import { useRealtimeWebRTC } from "@/hooks/use-realtime-webrtc";
import { VoiceTranscript } from "@/components/manual/VoiceTranscript";

const Ask = () => {
  const { language, setLanguage } = useLanguage();
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState<{
    question: string;
    answer: string;
    citations: Citation[];
    isLoading: boolean;
    isExpanding: boolean;
  } | null>(null);

  const { ask, isLoading } = useAskAI();
  const { data: usage, incrementUsageOptimistically, isAtLimit, isLoading: usageLoading } = useUsageLimits();

  // Get voice permissions
  const primaryGroup = permissions?.memberships?.[0];
  const voiceEnabled = primaryGroup?.policy?.voiceEnabled ?? false;
  const groupId = primaryGroup?.groupId ?? '';

  // Voice mode hook
  const voiceHook = useRealtimeWebRTC({
    language,
    groupId,
    onError: (err) => {
      console.error('[Ask] Voice error:', err);
    },
  });

  const isVoiceActive = voiceHook.state !== 'disconnected';

  const handleVoiceConnect = useCallback(() => {
    if (groupId) {
      voiceHook.connect();
    }
  }, [groupId, voiceHook]);

  const handleVoiceDisconnect = useCallback(() => {
    voiceHook.disconnect();
  }, [voiceHook]);

  const handleAsk = async () => {
    if (!question.trim() || isLoading || isAtLimit) return;
    
    const askedQuestion = question;
    setQuestion("");
    
    setCurrentAnswer({
      question: askedQuestion,
      answer: "",
      citations: [],
      isLoading: true,
      isExpanding: false,
    });

    const result = await ask(askedQuestion);

    if (result) {
      incrementUsageOptimistically();
      setCurrentAnswer({
        question: askedQuestion,
        answer: result.answer,
        citations: result.citations,
        isLoading: false,
        isExpanding: false,
      });
    } else {
      // Error occurred - clear the loading state
      setCurrentAnswer(null);
    }
  };


  const handleSourceClick = (citation: Citation) => {
    navigate(`/manual/${citation.slug}`);
  };

  const handleExpandAnswer = async () => {
    if (!currentAnswer || currentAnswer.isLoading || currentAnswer.isExpanding) return;
    
    setCurrentAnswer(prev => prev ? { ...prev, isExpanding: true } : null);

    const result = await ask(currentAnswer.question, { expand: true });

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
  };

  // Map citations to AISource format for the card
  const mapCitationsToSources = (citations: Citation[]) => 
    citations.map(c => ({
      id: c.id,
      label: c.title,
      sectionId: c.slug,
    }));

  // Labels
  const labels = {
    title: language === 'es' ? 'Preguntar AI' : 'Ask AI',
    subtitle: language === 'es' 
      ? 'Obtén respuestas instantáneas de tu manual de operaciones'
      : 'Get instant answers from your operations manual',
    placeholder: language === 'es' 
      ? 'Haz una pregunta sobre procedimientos...'
      : 'Ask a question about procedures...',
    limitReached: language === 'es'
      ? 'Has alcanzado tu límite diario de preguntas.'
      : 'You have reached your daily question limit.',
    tryAsking: language === 'es' ? 'Prueba preguntar:' : 'Try asking:',
    remaining: language === 'es' ? 'restantes hoy' : 'remaining today',
    voiceActive: language === 'es' ? 'Modo voz activo' : 'Voice mode active',
  };

  const sampleQuestions = language === 'es' ? [
    "¿A qué temperatura debo almacenar el pollo crudo?",
    "¿Con qué frecuencia debo limpiar la freidora?",
    "¿Cuál es el procedimiento de lavado de manos?",
  ] : [
    "What temperature should I store raw chicken?",
    "How often should I clean the fryer?",
    "What's the hand washing procedure?",
  ];

  // AI Panel content for desktop
  const aiPanel = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">
            {language === 'es' ? 'Asistente AI' : 'AI Assistant'}
          </span>
        </div>
        <UsageMeter 
          used={usage.daily.used} 
          total={usage.daily.limit}
          label={labels.remaining}
          isLoading={usageLoading}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {/* Voice Mode: Show transcript */}
        {isVoiceActive ? (
          <VoiceTranscript
            entries={voiceHook.transcript}
            maxEntries={5}
            language={language}
            className="h-full"
          />
        ) : currentAnswer ? (
          <AIAnswerCard
            question={currentAnswer.question}
            answer={currentAnswer.answer}
            isLoading={currentAnswer.isLoading}
            isExpanding={currentAnswer.isExpanding}
            sources={!currentAnswer.isLoading ? mapCitationsToSources(currentAnswer.citations) : undefined}
            onSourceClick={(source) => {
              const citation = currentAnswer.citations.find(c => c.id === source.id);
              if (citation) handleSourceClick(citation);
            }}
            onExpand={handleExpandAnswer}
          />
        ) : null}
      </div>
    </div>
  );

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      aiPanel={aiPanel}
    >
      <div className="space-y-xl">
        <div className="space-y-sm">
          <PageTitle>{labels.title}</PageTitle>
          <MetaText>{labels.subtitle}</MetaText>
        </div>

        {/* Usage meter (mobile only) */}
        <div className="lg:hidden">
          <Card>
            <CardContent>
              <UsageMeter 
                used={usage.daily.used} 
                total={usage.daily.limit}
                label={labels.remaining}
                isLoading={usageLoading}
              />
            </CardContent>
          </Card>
        </div>

        {/* Question input */}
        <Card>
          <CardContent>
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
              // Text mode
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <VoiceChatInput
                      value={question}
                      onChange={setQuestion}
                      onSubmit={handleAsk}
                      placeholder={labels.placeholder}
                      disabled={isAtLimit}
                      isLoading={isLoading}
                      language={language}
                      voiceEnabled={false}
                    />
                  </div>
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
          </CardContent>
        </Card>

        {/* Voice transcript (mobile only, when active) */}
        {isVoiceActive && (
          <div className="lg:hidden">
            <Card>
              <CardContent>
                <VoiceTranscript
                  entries={voiceHook.transcript}
                  maxEntries={5}
                  language={language}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Answer display (mobile/tablet, text mode only) */}
        {!isVoiceActive && (
          <div className="lg:hidden">
            {currentAnswer && (
              <AIAnswerCard
                question={currentAnswer.question}
                answer={currentAnswer.answer}
                isLoading={currentAnswer.isLoading}
                isExpanding={currentAnswer.isExpanding}
                sources={!currentAnswer.isLoading ? mapCitationsToSources(currentAnswer.citations) : undefined}
                onSourceClick={(source) => {
                  const citation = currentAnswer.citations.find(c => c.id === source.id);
                  if (citation) handleSourceClick(citation);
                }}
                onExpand={handleExpandAnswer}
              />
            )}
          </div>
        )}

        {/* Sample questions (hide when voice active) */}
        {!isVoiceActive && (
          <div className="space-y-md">
            <MetaText>{labels.tryAsking}</MetaText>
            <div className="flex flex-wrap gap-sm">
              {sampleQuestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuestion(q)}
                  className="text-left h-auto py-2"
                  disabled={isLoading || isAtLimit}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Ask;
