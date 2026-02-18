import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { ContentPanel } from '@/components/training/ContentPanel';
import { TrainingChatPanel } from '@/components/training/TrainingChatPanel';
import { useLearningSession } from '@/hooks/use-learning-session';
import { useTrainingChat } from '@/hooks/use-training-chat';
import { useLanguage } from '@/hooks/use-language';

export default function LearningSession() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const session = useLearningSession();
  const [activeTab, setActiveTab] = useState<'content' | 'teacher'>('content');

  const chat = useTrainingChat({
    sectionId: session.currentSection?.id,
    enrollmentId: session.enrollment?.id,
    contentContext: session.contentContext,
    topicsTotal: [],
  });

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
            {language === 'es'
              ? 'Sección no encontrada.'
              : 'Section not found.'}
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

  return (
    <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
      <div className="flex flex-col h-full">
        {/* Section navigation header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => navigate(`/courses/${session.programSlug}/${session.courseSlug}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{sectionTitle}</h2>
            <p className="text-xs text-muted-foreground truncate">
              {courseTitle}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!session.prevSection}
              onClick={() =>
                session.prevSection &&
                navigate(
                  `/courses/${session.programSlug}/${session.courseSlug}/${session.prevSection.slug}`
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {session.currentIndex + 1}/{session.sections.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={!session.nextSection}
              onClick={() =>
                session.nextSection &&
                navigate(
                  `/courses/${session.programSlug}/${session.courseSlug}/${session.nextSection.slug}`
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
        <div className="flex-1 min-h-0 flex">
          {/* Desktop: side-by-side 55% / 45% */}
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
              className="w-[55%] border-r"
            />
            <TrainingChatPanel
              sectionTitle={sectionTitle}
              messages={chat.messages}
              suggestedReplies={chat.suggestedReplies}
              topicsCovered={chat.topicsCovered}
              topicsTotal={chat.topicsTotal}
              shouldSuggestQuiz={false}
              isSending={chat.isSending}
              conversationId={chat.conversationId}
              existingConversations={chat.existingConversations}
              onSendMessage={chat.sendMessage}
              onResumeSession={chat.resumeSession}
              onStartNewSession={chat.startNewSession}
              onStartQuiz={undefined}
              language={chat.language}
              className="w-[45%]"
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
                messages={chat.messages}
                suggestedReplies={chat.suggestedReplies}
                topicsCovered={chat.topicsCovered}
                topicsTotal={chat.topicsTotal}
                shouldSuggestQuiz={false}
                isSending={chat.isSending}
                conversationId={chat.conversationId}
                existingConversations={chat.existingConversations}
                onSendMessage={chat.sendMessage}
                onResumeSession={chat.resumeSession}
                onStartNewSession={chat.startNewSession}
                onStartQuiz={undefined}
                language={chat.language}
                className="w-full"
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
