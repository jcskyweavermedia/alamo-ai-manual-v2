import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { useCourses } from '@/hooks/use-courses';
import { useProgramEnrollment } from '@/hooks/use-program-enrollment';

import { ProgressRing } from '@/components/training/ProgressRing';
import { CourseCard } from '@/components/training/CourseCard';
import type { TrainingProgramRaw, TrainingProgram } from '@/types/training';
import { transformTrainingProgram } from '@/types/training';

const ProgramDetail = () => {
  const { programSlug } = useParams<{ programSlug: string }>();
  const { language, setLanguage } = useLanguage();
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  // Fetch program by slug
  const { data: program = null, isLoading: programLoading, error: programError } = useQuery({
    queryKey: ['program', programSlug, groupId],
    queryFn: async (): Promise<TrainingProgram | null> => {
      if (!programSlug || !groupId) return null;

      const { data, error } = await supabase
        .from('training_programs')
        .select('*')
        .eq('slug', programSlug)
        .eq('group_id', groupId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return transformTrainingProgram(data as TrainingProgramRaw);
    },
    enabled: !!programSlug && !!groupId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch courses for this program
  const { courses, isLoading: coursesLoading, error: coursesError } = useCourses(program?.id);

  // Auto-enroll in program
  useProgramEnrollment({ programId: program?.id, autoEnroll: true });


  const isLoading = programLoading || coursesLoading;
  const error = programError || coursesError;

  const completedCount = courses.filter((c) => c.progressPercent === 100).length;
  const totalCount = courses.length;
  const progressPercent = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  const title = program
    ? language === 'es' && program.titleEs ? program.titleEs : program.titleEn
    : '';

  const progressLabel = language === 'es'
    ? `${completedCount} de ${totalCount} cursos`
    : `${completedCount} of ${totalCount} courses`;

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
            {language === 'es' ? 'Error al cargar el programa' : 'Failed to load program'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className={cn(
                'flex items-center justify-center shrink-0',
                'h-10 w-10 rounded-lg',
                'bg-orange-500 text-white',
                'hover:bg-orange-600 active:bg-orange-700',
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
              {program?.estimatedMinutes ? (
                <p className="text-xs text-muted-foreground">
                  ~{program.estimatedMinutes} min {language === 'es' ? 'total' : 'total'}
                </p>
              ) : null}
            </div>
          </div>

          {/* Courses grid */}
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {language === 'es'
                ? 'Este programa aun no tiene cursos.'
                : 'This program has no courses yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  language={language}
                  onClick={() => navigate(`/courses/${programSlug}/${course.slug}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default ProgramDetail;
