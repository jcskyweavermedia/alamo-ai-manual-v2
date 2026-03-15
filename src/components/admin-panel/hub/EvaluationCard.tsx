// =============================================================================
// EvaluationCard -- Single evaluation row with score, badges, and feedback
// =============================================================================

import { CheckCircle, XCircle } from 'lucide-react';
import type { EvaluationRow } from '@/hooks/use-evaluations-dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EvaluationCardProps {
  evaluation: EvaluationRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function getCompetencyColor(level: string): string {
  switch (level) {
    case 'expert': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'proficient': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'competent': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    default: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvaluationCard({ evaluation }: EvaluationCardProps) {
  const e = evaluation;

  return (
    <div className="bg-card rounded-xl border border-black/[0.04] dark:border-white/[0.06] p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{e.user_full_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {e.course_title}{e.section_title ? ` \u2014 ${e.section_title}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {e.passed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className={`text-sm font-bold ${getScoreColor(e.score)}`}>{e.score}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
          {e.eval_type}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getCompetencyColor(e.competency_level)}`}>
          {e.competency_level}
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
          {timeAgo(e.created_at)}
        </span>
      </div>

      {e.student_feedback?.strengths && e.student_feedback.strengths.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {e.student_feedback.strengths.slice(0, 3).map((s, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {s}
            </span>
          ))}
        </div>
      )}

      {e.student_feedback?.areas_for_improvement && e.student_feedback.areas_for_improvement.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {e.student_feedback.areas_for_improvement.slice(0, 3).map((a, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
