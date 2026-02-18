import { Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { usePrograms } from '@/hooks/use-programs';
import { useMyRollouts } from '@/hooks/use-my-rollouts';
import { ProgramCard } from '@/components/training/ProgramCard';

const EMPTY_TEXT = {
  en: 'No training programs available yet.',
  es: 'Aun no hay programas de capacitacion disponibles.',
} as const;

const TrainingHome = () => {
  const { language, setLanguage } = useLanguage();
  const { programs, isLoading, error } = usePrograms();
  const { assignments } = useMyRollouts();
  const navigate = useNavigate();

  const activeRollout = assignments[0];

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
    >
      {activeRollout?.rollouts?.deadline && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {activeRollout.rollouts.name} &mdash;{' '}
            {language === 'es'
              ? `Completa antes del ${new Date(activeRollout.rollouts.deadline).toLocaleDateString()}`
              : `Complete by ${new Date(activeRollout.rollouts.deadline).toLocaleDateString()}`}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {language === 'es' ? 'Error al cargar programas' : 'Failed to load programs'}
          </p>
        </div>
      ) : programs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <GraduationCap className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{EMPTY_TEXT[language]}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              language={language}
              onClick={() => navigate(`/courses/${program.slug}`)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default TrainingHome;
