import { CheckCircle2, Circle, Disc, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { SectionWithProgress, SectionType } from '@/types/training';

interface SectionListItemProps {
  section: SectionWithProgress;
  language: 'en' | 'es';
  onClick: () => void;
}

const TYPE_LABELS: Record<SectionType, { en: string; es: string }> = {
  learn: { en: 'Learn', es: 'Aprender' },
  practice: { en: 'Practice', es: 'Practicar' },
  quiz: { en: 'Quiz', es: 'Cuestionario' },
  overview: { en: 'Overview', es: 'General' },
};

const TYPE_COLORS: Record<SectionType, string> = {
  learn: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  practice: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
  quiz: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  overview: 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-400',
};

export function SectionListItem({ section, language, onClick }: SectionListItemProps) {
  const title = language === 'es' ? section.titleEs : section.titleEn;
  const typeLabel = TYPE_LABELS[section.sectionType]?.[language] ?? section.sectionType;
  const typeColor = TYPE_COLORS[section.sectionType] ?? TYPE_COLORS.overview;

  const isCompleted = section.progressStatus === 'completed';
  const isInProgress = section.progressStatus === 'in_progress';

  const StatusIcon = isCompleted
    ? CheckCircle2
    : isInProgress
      ? Disc
      : Circle;

  const statusColor = isCompleted
    ? 'text-green-500'
    : isInProgress
      ? 'text-blue-500'
      : 'text-muted-foreground/40';

  const timeLabel = section.estimatedMinutes
    ? `~${section.estimatedMinutes} min`
    : '';

  const progressLabel =
    isInProgress && section.topicsTotal > 0
      ? `${section.topicsCovered}/${section.topicsTotal} ${language === 'es' ? 'temas' : 'topics'}`
      : '';

  // Quiz status
  const hasQuiz = section.quizEnabled;
  const quizPassed = section.quizPassed === true;
  const quizAttempted = section.quizScore !== null;
  const quizLabel = quizPassed
    ? `${language === 'es' ? 'Practica' : 'Practice'}: ${section.quizScore}%`
    : quizAttempted
      ? `${language === 'es' ? 'Practica' : 'Practice'}: ${section.quizScore}%`
      : '';

  return (
    <Card
      className="cursor-pointer hover:shadow-elevated transition-shadow duration-200"
      onClick={onClick}
    >
      <CardContent className="flex items-start gap-3 p-4">
        {/* Status icon */}
        <StatusIcon className={cn('h-5 w-5 mt-0.5 shrink-0', statusColor)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground leading-tight">
              {title}
            </h4>
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0 border-0', typeColor)}
            >
              {typeLabel}
            </Badge>
          </div>

          {/* Meta line */}
          <div className="flex items-center gap-2 mt-1">
            {timeLabel && (
              <span className="text-xs text-muted-foreground">{timeLabel}</span>
            )}
            {progressLabel && (
              <>
                {timeLabel && <span className="text-xs text-muted-foreground">&middot;</span>}
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  {progressLabel}
                </span>
              </>
            )}
            {quizLabel && (
              <>
                {(timeLabel || progressLabel) && (
                  <span className="text-xs text-muted-foreground">&middot;</span>
                )}
                <span className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  quizPassed
                    ? 'text-green-600 dark:text-green-400'
                    : quizAttempted
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground'
                )}>
                  <ClipboardCheck className="h-3 w-3" />
                  {quizLabel}
                </span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
