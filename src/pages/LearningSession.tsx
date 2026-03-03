import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, GraduationCap, Loader2 } from 'lucide-react';
import { RiUserVoiceFill } from 'react-icons/ri';
import { BsChatDotsFill } from 'react-icons/bs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { ContentPanel } from '@/components/training/ContentPanel';
import { TrainingChatPanel } from '@/components/training/TrainingChatPanel';
import { LiveTrainerFloatingButton } from '@/components/training/LiveTrainerFloatingButton';
import { useLearningSession } from '@/hooks/use-learning-session';
import { useTrainingChat } from '@/hooks/use-training-chat';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import type { WebRTCVoiceState } from '@/hooks/use-realtime-webrtc';

export default function LearningSession() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const session = useLearningSession();
  const [activeTab, setActiveTab] = useState<'content' | 'teacher'>('content');
  const [pendingMode, setPendingMode] = useState<'quiz_me' | null>(null);
  const [voiceState, setVoiceState] = useState<WebRTCVoiceState | 'disconnected'>('disconnected');
  const [floatingMounted, setFloatingMounted] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const voiceControlsRef = useRef<{ disconnect: () => void; interruptAndAsk: () => void }>(
    { disconnect: () => {}, interruptAndAsk: () => {} }
  );
  const { permissions } = useAuth();
  const voiceEnabled = permissions?.voiceEnabled ?? false;

  const chat = useTrainingChat({
    sectionId: session.currentSection?.id,
    enrollmentId: session.enrollment?.id,
    contentContext: session.contentContext,
    topicsTotal: [],
    teacherSlug: session.course?.teacherSlug ?? null,
  });

  const handleVoiceStateChange = useCallback(
    (
      state: WebRTCVoiceState | 'disconnected',
      controls: { disconnect: () => void; interruptAndAsk: () => void }
    ) => {
      setVoiceState(state);
      voiceControlsRef.current = controls;

      // Show pill ONLY during the connecting phase
      if (state === 'connecting') {
        setFloatingMounted(true);
        requestAnimationFrame(() => setFloatingVisible(true));
      }

      // Dismiss pill as soon as session goes live (or disconnects)
      if (state !== 'connecting' && floatingMounted) {
        setFloatingVisible(false);
        setTimeout(() => setFloatingMounted(false), 320);
      }
    },
    [floatingMounted]
  );

  // Auto-complete section when user views last content item
  useEffect(() => {
    if (
      session.totalItems > 0 &&
      session.itemIndex === session.totalItems - 1 &&
      session.progress &&
      session.progress.status !== 'completed'
    ) {
      session.markComplete();
    }
  }, [session.itemIndex, session.totalItems]);

  if (session.isLoading) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (session.error || !session.currentSection || !session.course) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <p className="text-sm text-destructive">
            {language === 'es' ? 'Sección no encontrada.' : 'Section not found.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {language === 'es' ? 'Volver' : 'Go back'}
          </Button>
        </div>
      </AppShell>
    );
  }

  const sectionTitle =
    language === 'es' && session.currentSection.titleEs
      ? session.currentSection.titleEs
      : session.currentSection.titleEn;

  const courseTitle =
    language === 'es' && session.course.titleEs
      ? session.course.titleEs
      : session.course.titleEn;

  const triggerLiveTrainer = () => {
    setPendingMode('quiz_me');
    setActiveTab('teacher');
  };

  const triggerQuickQuiz = () => {
    navigate(
      `/courses/${session.programSlug}/${session.courseSlug}/${session.sectionSlug}/quiz`
    );
  };

  const headerToolbar = session.currentSection?.quizEnabled ? (
    <div className="flex items-center gap-3 shrink-0">
      <span className="text-sm font-semibold text-foreground whitespace-nowrap">
        {language === 'es' ? 'Práctica de Quiz' : 'Practice Quiz'}
      </span>
      <button
        type="button"
        onClick={triggerLiveTrainer}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card shadow-sm border border-border/50 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
      >
        <RiUserVoiceFill className="h-4 w-4" />
        <span className="text-xs font-medium whitespace-nowrap">
          {language === 'es' ? 'Entrenador' : 'Live Trainer'}
        </span>
      </button>
      <button
        type="button"
        onClick={triggerQuickQuiz}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-card shadow-sm border border-border/50 text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
      >
        <BsChatDotsFill className="h-4 w-4" />
        <span className="text-xs font-medium whitespace-nowrap">
          {language === 'es' ? 'Opción Múltiple' : 'Multiple Choice'}
        </span>
      </button>
    </div>
  ) : undefined;

  const headerLeft = (
    <div className="flex items-center gap-2 min-w-0">
      <button
        type="button"
        onClick={() =>
          navigate(`/courses/${session.programSlug}/${session.courseSlug}`)
        }
        className="flex items-center justify-center shrink-0 h-9 w-9 rounded-lg bg-orange-500 text-white hover:bg-orange-600 active:scale-[0.96] shadow-sm transition-all duration-150"
        title="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate max-w-[200px] md:max-w-xs">
          {sectionTitle}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-[200px] md:max-w-xs">
          {courseTitle}
        </p>
      </div>
    </div>
  );

  return (
    <AppShell
      rawContent
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerLeft={headerLeft}
      headerToolbar={headerToolbar}
      itemNav={{
        hasPrev: !!session.prevSection,
        hasNext: !!session.nextSection,
        onPrev: () =>
          session.prevSection &&
          navigate(
            `/courses/${session.programSlug}/${session.courseSlug}/${session.prevSection.slug}`
          ),
        onNext: () =>
          session.nextSection &&
          navigate(
            `/courses/${session.programSlug}/${session.courseSlug}/${session.nextSection.slug}`
          ),
        current: session.currentIndex + 1,
        total: session.sections.length,
      }}
    >
      <div className="flex flex-col h-full">
        {/* Mobile tab toggle (< 768px) */}
        <div className="flex md:hidden border-b shrink-0">
          <button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'content'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            )}
            onClick={() => setActiveTab('content')}
          >
            <BookOpen className="h-4 w-4" />
            {language === 'es' ? 'Contenido' : 'Content'}
          </button>
          <button
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
              activeTab === 'teacher'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground'
            )}
            onClick={() => setActiveTab('teacher')}
          >
            <GraduationCap className="h-4 w-4" />
            {language === 'es' ? 'Maestro' : 'Teacher'}
          </button>
        </div>

        {/* Content area */}
        <div className="flex-1 min-h-0 flex relative">
          {/* Desktop: side-by-side 65% / 35% */}
          <div className="hidden md:flex w-full">
            <ContentPanel
              section={session.currentSection}
              contentSource={session.currentSection.contentSource}
              contentItems={session.contentItems}
              currentItem={session.currentItem}
              itemIndex={session.itemIndex}
              totalItems={session.totalItems}
              onItemChange={session.setItemIndex}
              language={language}
              className="w-[65%] border-r"
            />
            <TrainingChatPanel
              sectionTitle={sectionTitle}
              chatItems={chat.chatItems}
              suggestedReplies={chat.suggestedReplies}
              topicsCovered={chat.topicsCovered}
              topicsTotal={chat.topicsTotal}
              shouldSuggestQuiz={false}
              isSending={chat.isSending}
              hasHistory={chat.hasHistory}
              onSendMessage={chat.sendMessage}
              onResumeLatest={chat.resumeLatest}
              onStartNewSession={chat.startNewSession}
              onStartQuiz={undefined}
              isLoadingHistory={chat.isLoadingHistory}
              voiceEnabled={voiceEnabled}
              language={chat.language}
              pendingMode={pendingMode}
              onPendingModeConsumed={() => setPendingMode(null)}
              teacherSlug={session.course?.teacherSlug ?? null}
              sectionId={session.currentSection?.id}
              appendVoiceMessage={chat.appendVoiceMessage}
              onVoiceStateChange={handleVoiceStateChange}
              className="w-[35%]"
            />
          </div>

          {/* Mobile: tabbed */}
          <div className="flex md:hidden flex-1">
            {activeTab === 'content' ? (
              <ContentPanel
                section={session.currentSection}
                contentSource={session.currentSection.contentSource}
                contentItems={session.contentItems}
                currentItem={session.currentItem}
                itemIndex={session.itemIndex}
                totalItems={session.totalItems}
                onItemChange={session.setItemIndex}
                language={language}
                className="w-full"
              />
            ) : (
              <TrainingChatPanel
                sectionTitle={sectionTitle}
                chatItems={chat.chatItems}
                suggestedReplies={chat.suggestedReplies}
                topicsCovered={chat.topicsCovered}
                topicsTotal={chat.topicsTotal}
                shouldSuggestQuiz={false}
                isSending={chat.isSending}
                hasHistory={chat.hasHistory}
                onSendMessage={chat.sendMessage}
                onResumeLatest={chat.resumeLatest}
                onStartNewSession={chat.startNewSession}
                onStartQuiz={undefined}
                isLoadingHistory={chat.isLoadingHistory}
                voiceEnabled={voiceEnabled}
                language={chat.language}
                pendingMode={pendingMode}
                onPendingModeConsumed={() => setPendingMode(null)}
                teacherSlug={session.course?.teacherSlug ?? null}
                sectionId={session.currentSection?.id}
                appendVoiceMessage={chat.appendVoiceMessage}
                onVoiceStateChange={handleVoiceStateChange}
                className="w-full"
              />
            )}
          </div>

          {/* Floating Live Trainer pill — spans full width of both panels */}
          {floatingMounted && (
            <LiveTrainerFloatingButton
              state={voiceState === 'disconnected' ? 'connected' : voiceState as WebRTCVoiceState}
              language={language}
              visible={floatingVisible}
              onInterrupt={() => voiceControlsRef.current.interruptAndAsk()}
              onEndSession={() => voiceControlsRef.current.disconnect()}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
