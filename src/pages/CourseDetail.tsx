import { Loader2, AlertCircle, ArrowLeft, ClipboardCheck, GraduationCap } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useCourseSections } from '@/hooks/use-course-sections';
import { useEnrollment } from '@/hooks/use-enrollment';
import { useCourseAssessment } from '@/hooks/use-course-assessment';
import { ProgressRing } from '@/components/training/ProgressRing';
import { SectionListItem } from '@/components/training/SectionListItem';
import { AssessmentCard } from '@/components/training/AssessmentCard';

const CourseDetail = () => {
  const { programSlug, courseSlug } = useParams<{ programSlug: string; courseSlug: string }>();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const { course, sections, isLoading, error } = useCourseSections(courseSlug);

  // Auto-enroll on mount
  useEnrollment({ courseId: course?.id, autoEnroll: true });

  const assessment = useCourseAssessment({ courseId: course?.id });

  const completedCount = sections.filter((s) => s.progressStatus === 'completed').length;
  const totalCount = sections.length;
  const progressPercent = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const title = course
    ? language === 'es' ? course.titleEs : course.titleEn
    : '';

  const progressLabel = language === 'es'
    ? `${completedCount} de ${totalCount} secciones`
    : `${completedCount} of ${totalCount} sections`;

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {language === 'es' ? 'Error al cargar el curso' : 'Failed to load course'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(`/courses/${programSlug}`)}
              className={cn(
                'flex items-center justify-center shrink-0',
                'h-10 w-10 rounded-lg',
                'bg-primary text-primary-foreground',
                'hover:bg-primary/90 active:bg-primary/80',
                'shadow-sm transition-colors duration-150',
                'mt-0.5'
              )}
              title={language === 'es' ? 'Volver' : 'Back'}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-page-title text-foreground">{title}</h1>
            </div>
          </div>

          {/* Progress summary */}
          <div className="flex items-center gap-4">
            <ProgressRing percent={progressPercent} size={64} strokeWidth={5} />
            <div>
              <p className="text-sm font-semibold text-foreground">{progressLabel}</p>
              {course?.estimatedMinutes && (
                <p className="text-xs text-muted-foreground">
                  ~{course.estimatedMinutes} min {language === 'es' ? 'total' : 'total'}
                </p>
              )}
            </div>
          </div>

          {/* Sections grid */}
          {sections.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {language === 'es'
                ? 'Este curso aun no tiene secciones.'
                : 'This course has no sections yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sections.map((section) => (
                <SectionListItem
                  key={section.id}
                  section={section}
                  language={language}
                  onClick={() => navigate(`/courses/${programSlug}/${courseSlug}/${section.slug}`)}
                />
              ))}
            </div>
          )}

          {/* Assessment section */}
          {sections.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {language === 'es' ? 'Evaluacion' : 'Assessment'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AssessmentCard
                  icon={ClipboardCheck}
                  title={language === 'es' ? 'Examen de Certificacion' : 'Certification Test'}
                  description={
                    language === 'es'
                      ? 'Examen final que cubre todas las secciones'
                      : 'Final test covering all sections'
                  }
                  statusLabel={
                    assessment.moduleTestStatus === 'passed'
                      ? `${language === 'es' ? 'Puntuacion' : 'Score'}: ${assessment.moduleTestScore}% - ${language === 'es' ? 'Aprobado' : 'Passed'}`
                      : assessment.moduleTestStatus === 'failed'
                        ? `${language === 'es' ? 'Puntuacion' : 'Score'}: ${assessment.moduleTestScore}% - ${language === 'es' ? 'Reintentar' : 'Try again'}`
                        : assessment.moduleTestStatus === 'in_progress'
                          ? language === 'es' ? 'En progreso' : 'In progress'
                          : language === 'es' ? 'No iniciado' : 'Not started'
                  }
                  statusVariant={
                    assessment.moduleTestStatus === 'passed' ? 'success'
                      : assessment.moduleTestStatus === 'failed' ? 'warning'
                        : assessment.moduleTestStatus === 'in_progress' ? 'info'
                          : 'default'
                  }
                  onClick={() => navigate(`/courses/${programSlug}/${courseSlug}/test`)}
                />
                <AssessmentCard
                  icon={GraduationCap}
                  title={language === 'es' ? 'Practica con Tutor' : 'Practice with Tutor'}
                  description={
                    language === 'es'
                      ? 'Practica conversacional con IA'
                      : 'Conversational AI practice'
                  }
                  statusLabel={
                    assessment.tutorStatus === 'ready'
                      ? language === 'es' ? 'Listo para el examen!' : 'Ready for test!'
                      : assessment.tutorStatus === 'in_progress'
                        ? `${language === 'es' ? 'En progreso' : 'In progress'} (${assessment.tutorReadinessScore}%)`
                        : language === 'es' ? 'No iniciado' : 'Not started'
                  }
                  statusVariant={
                    assessment.tutorStatus === 'ready' ? 'success'
                      : assessment.tutorStatus === 'in_progress' ? 'info'
                        : 'default'
                  }
                  onClick={() => navigate(`/courses/${programSlug}/${courseSlug}/practice`)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default CourseDetail;
