import { Calendar, Users, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RolloutWithProgress } from '@/types/dashboard';

interface RolloutCardProps {
  rollout: RolloutWithProgress;
  onClick: () => void;
  language: 'en' | 'es';
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  archived: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

export function RolloutCard({ rollout, onClick, language }: RolloutCardProps) {
  const isEs = language === 'es';

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">
            {rollout.name}
          </h3>
          <Badge
            variant="outline"
            className={cn('shrink-0 text-[10px] uppercase', STATUS_STYLES[rollout.status])}
          >
            {rollout.status}
          </Badge>
        </div>

        {/* Deadline */}
        {rollout.deadline && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>
              {isEs ? 'Fecha limite' : 'Deadline'}:{' '}
              {new Date(rollout.deadline).toLocaleDateString()}
            </span>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${rollout.progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              <Users className="h-3 w-3 inline mr-0.5" />
              {rollout.completedAssignees}/{rollout.totalAssignees}{' '}
              {isEs ? 'completados' : 'completed'}
            </span>
            {rollout.overdueAssignees > 0 && (
              <span className="text-red-500">
                {rollout.overdueAssignees} {isEs ? 'atrasados' : 'overdue'}
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            {rollout.courseIds.length} {isEs ? 'cursos' : 'courses'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(rollout.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
