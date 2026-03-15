// =============================================================================
// EmployeeCoursePanel -- Content panel for a selected course
// Two-column: course progress + modules (left), AI summary + cohort + actions (right)
// =============================================================================

import {
  Check,
  AlertTriangle,
  Play,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminEmployeeCourse, AdminEmployee, AdminModuleResult } from '@/types/admin-panel';
import { ProgressBar } from '../shared/ProgressBar';
import { AIGlowCard } from '../shared/AIGlowCard';
import { ADMIN_STRINGS } from '../strings';
import { VsCohortCard } from './VsCohortCard';
import { QuickActionsCard } from './QuickActionsCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeCoursePanelProps {
  course: AdminEmployeeCourse;
  employee: AdminEmployee;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: AdminEmployeeCourse['status'], t: (typeof ADMIN_STRINGS)['en'], language: 'en' | 'es') {
  switch (status) {
    case 'completed':
      return { text: t.completed, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
    case 'in_progress':
      return { text: t.inProgress, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'not_started':
      return { text: t.notStarted, className: 'bg-muted text-muted-foreground' };
    case 'locked':
      return { text: language === 'es' ? 'Bloqueado' : 'Locked', className: 'bg-muted text-muted-foreground' };
    default:
      return { text: status, className: 'bg-muted text-muted-foreground' };
  }
}

function getGradeBadgeClass(grade?: string) {
  switch (grade) {
    case 'A':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'B':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'C':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'D':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getScoreColor(score?: number) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getProgressBarColor(status: AdminEmployeeCourse['status']) {
  if (status === 'completed') return 'bg-green-500';
  return 'bg-blue-500';
}

function getAttemptChipColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  if (score >= 60) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

// ---------------------------------------------------------------------------
// Not-started / locked empty state
// ---------------------------------------------------------------------------

function CourseEmptyState({ course, language }: { course: AdminEmployeeCourse; language: 'en' | 'es' }) {
  const t = ADMIN_STRINGS[language];
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-bold mb-1">{course.courseName}</h3>
      <p className="text-sm text-muted-foreground max-w-[400px]">
        {language === 'es'
          ? 'Este curso aún no ha sido iniciado.'
          : 'This course has not been started yet.'}
      </p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
        <Lock className="h-3.5 w-3.5" />
        <span>
          {course.modulesTotal} {t.modules}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Module row
// ---------------------------------------------------------------------------

function ModuleRow({ mod, language }: { mod: AdminModuleResult; language: 'en' | 'es' }) {
  const t = ADMIN_STRINGS[language];
  const hasAttemptHistory = mod.attemptHistory && mod.attemptHistory.length > 1;

  // Styling per status
  const statusConfig = {
    completed: {
      bg: '',
      border: '',
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      icon: <Check className="h-3.5 w-3.5 text-green-600" />,
    },
    warning: {
      bg: 'bg-amber-50/80 dark:bg-amber-950/20',
      border: 'border border-amber-200 dark:border-amber-800',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
    },
    in_progress: {
      bg: 'bg-blue-50/80 dark:bg-blue-950/20',
      border: 'border border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      icon: <Play className="h-3.5 w-3.5 text-blue-600" />,
    },
    locked: {
      bg: '',
      border: 'border border-dashed border-border',
      iconBg: 'bg-muted',
      icon: <Lock className="h-3.5 w-3.5 text-muted-foreground" />,
    },
  };

  const cfg = statusConfig[mod.status];

  const subtitleParts: string[] = [];
  if (mod.completedDate) subtitleParts.push(`${t.completed} ${mod.completedDate}`);
  if (mod.status === 'in_progress' && mod.progressPercent != null) {
    subtitleParts.push(`${t.inProgress} - ${mod.progressPercent}%`);
  }
  if (mod.status === 'locked') subtitleParts.push(`${t.unlocks} ${language === 'es' ? 'módulo anterior' : 'previous module'}`);
  if (mod.attempts != null) {
    subtitleParts.push(`${mod.attempts} ${mod.attempts === 1 ? t.attempt : t.attempts}`);
  }
  if (mod.duration) subtitleParts.push(mod.duration);

  return (
    <div className={cn('p-3 rounded-xl', cfg.bg, cfg.border, mod.status === 'locked' && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', cfg.iconBg)}>
          {cfg.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm font-medium', mod.status === 'in_progress' && 'font-semibold')}>
              {mod.name}
            </span>
            {(mod.attempts ?? 0) > 1 && mod.status !== 'warning' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                {mod.attempts} {t.attempts}
              </span>
            )}
            {mod.status === 'warning' && mod.attempts != null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {mod.attempts} {t.attempts}
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5 text-muted-foreground">
            {subtitleParts.join(' \u00b7 ')}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(mod.status === 'completed' || mod.status === 'warning') && mod.score != null && (
            <>
              <div className="w-16">
                <ProgressBar
                  value={mod.score}
                  height={4}
                  colorClass={mod.status === 'warning' ? 'bg-amber-500' : 'bg-green-500'}
                />
              </div>
              <span className={cn('text-sm font-bold tabular-nums w-8 text-right', getScoreColor(mod.score))}>
                {mod.score}
              </span>
            </>
          )}
          {mod.status === 'in_progress' && mod.progressPercent != null && (
            <>
              <div className="w-16">
                <ProgressBar value={mod.progressPercent} height={4} colorClass="bg-blue-500" />
              </div>
              <span className="text-sm font-bold tabular-nums w-8 text-right text-blue-600 dark:text-blue-400">
                --
              </span>
            </>
          )}
          {mod.status === 'locked' && (
            <span className="text-sm w-8 text-right text-muted-foreground">--</span>
          )}
        </div>
      </div>

      {/* Attempt history for warning modules */}
      {mod.status === 'warning' && hasAttemptHistory && (
        <div className="mt-3 ml-10 p-3 rounded-xl bg-muted/50">
          <div className="text-xs font-semibold mb-2 text-muted-foreground">
            {t.attemptHistory}
          </div>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {mod.attemptHistory!.map((score, i) => (
              <span key={i} className="contents">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full tabular-nums font-medium',
                    getAttemptChipColor(score),
                  )}
                >
                  {t.attempt} {i + 1}: {score}
                </span>
                {i < mod.attemptHistory!.length - 1 && (
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            ))}
            {mod.attemptHistory!.length > 1 &&
              mod.attemptHistory![mod.attemptHistory!.length - 1] > mod.attemptHistory![0] && (
                <TrendingUp className="h-3.5 w-3.5 ml-1 text-green-600" />
              )}
          </div>
          {mod.struggleAreas && mod.struggleAreas.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {t.struggleWith}:{' '}
              {mod.struggleAreas.map((area, i) => (
                <span key={i}>
                  <strong className="text-foreground">{area}</strong>
                  {i < mod.struggleAreas!.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmployeeCoursePanel({ course, employee, language }: EmployeeCoursePanelProps) {
  const t = ADMIN_STRINGS[language];
  const statusBadge = getStatusBadge(course.status, t, language);

  // If course is not started or locked with no modules, show empty state
  if ((course.status === 'not_started' || course.status === 'locked') && course.modules.length === 0) {
    return <CourseEmptyState course={course} language={language} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
      {/* Left column */}
      <div className="space-y-4">
        {/* Course progress card */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{course.courseName}</h2>
                <span className={cn('text-xs px-2 py-0.5 rounded-full', statusBadge.className)}>
                  {statusBadge.text}
                </span>
              </div>
              <div className="text-sm mt-1 text-muted-foreground">
                {course.modulesCompleted} {t.of} {course.modulesTotal} {t.modules} {t.completed.toLowerCase()}
                {course.estFinish && ` \u00b7 ${language === 'es' ? 'Est. finalización' : 'Est. finish'}: ${course.estFinish}`}
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-3xl font-bold tabular-nums', course.score != null ? 'text-orange-500' : 'text-muted-foreground')}>
                {course.score ?? '--'}
              </div>
              {course.grade && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full inline-block mt-1', getGradeBadgeClass(course.grade))}>
                  {course.grade}
                </span>
              )}
            </div>
          </div>
          <ProgressBar
            value={course.progressPercent}
            height={6}
            colorClass={getProgressBarColor(course.status)}
          />
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {course.modulesCompleted} / {course.modulesTotal}
            </span>
            <span className="font-semibold text-foreground tabular-nums">
              {course.progressPercent}% {t.complete}
            </span>
          </div>
        </div>

        {/* Module results */}
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-5 pt-5 pb-2">
            <h3 className="font-semibold text-sm">{t.moduleResults}</h3>
          </div>
          <div className="px-3 pb-3 space-y-1">
            {course.modules.map((mod) => (
              <ModuleRow key={mod.id} mod={mod} language={language} />
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="space-y-4">
        {/* AI Course Summary */}
        {course.aiSummary && (
          <AIGlowCard title={t.aiCourseSummary}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {course.aiSummary}
            </p>
          </AIGlowCard>
        )}

        {/* Vs Cohort */}
        {course.vsCohort && course.vsCohort.length > 0 && (
          <VsCohortCard
            comparisons={course.vsCohort}
            employeeName={employee.name}
            language={language}
          />
        )}

        {/* Quick Actions */}
        <QuickActionsCard language={language} />
      </div>
    </div>
  );
}
