import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useCourseSections } from '@/hooks/use-course-sections';
import { useEnrollment } from '@/hooks/use-enrollment';
import { usePracticeTutor } from '@/hooks/use-practice-tutor';
import { TutorChatPanel } from '@/components/training/TutorChatPanel';

export default function PracticeTutorPage() {
  const { programSlug, courseSlug } = useParams();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const isEs = language === 'es';

  const { course, isLoading: sectionsLoading } = useCourseSections(courseSlug);
  const { enrollment } = useEnrollment({ courseId: course?.id, autoEnroll: true });

  const tutor = usePracticeTutor({
    courseId: course?.id,
    enrollmentId: enrollment?.id,
  });

  const courseTitle = course
    ? isEs && course.titleEs ? course.titleEs : course.titleEn
    : '';

  const backUrl = `/courses/${programSlug}/${courseSlug}`;

  if (sectionsLoading) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!course) {
    return (
      <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {isEs ? 'Curso no encontrado.' : 'Course not found.'}
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate(backUrl)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isEs ? 'Volver' : 'Go back'}
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell rawContent language={language} onLanguageChange={setLanguage} showSearch={false}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={() => navigate(backUrl)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">
              {isEs ? 'Practica con Tutor' : 'Practice with Tutor'}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{courseTitle}</p>
          </div>
        </div>

        {/* Chat panel */}
        <TutorChatPanel
          messages={tutor.messages}
          readinessScore={tutor.readinessScore}
          suggestTest={tutor.suggestTest}
          isSending={tutor.isSending}
          existingSessions={tutor.existingSessions}
          onSendMessage={tutor.sendMessage}
          onResumeSession={tutor.resumeSession}
          onStartNewSession={tutor.startNewSession}
          onTakeTest={() => navigate(`/courses/${programSlug}/${courseSlug}/test`)}
          language={language}
          className="flex-1 min-h-0"
        />
      </div>
    </AppShell>
  );
}
