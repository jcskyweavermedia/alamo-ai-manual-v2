import { Users, TrendingUp, BookOpen, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/types/dashboard';

interface DashboardStatsProps {
  summary: DashboardSummary | null;
  language: 'en' | 'es';
}

export function DashboardStats({ summary, language }: DashboardStatsProps) {
  const isEs = language === 'es';

  const stats = [
    {
      label: isEs ? 'Equipo' : 'Team',
      value: summary?.totalStaff ?? 0,
      subtitle: `${summary?.activeStaff ?? 0} ${isEs ? 'activos' : 'active'}`,
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: isEs ? 'Progreso' : 'Progress',
      value: `${summary?.teamAverage ?? 0}%`,
      subtitle: isEs ? 'promedio' : 'avg progress',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      label: isEs ? 'Cursos' : 'Courses',
      value: summary?.coursesPublished ?? 0,
      subtitle: isEs ? 'publicados' : 'published',
      icon: BookOpen,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
    },
    {
      label: isEs ? 'Atrasados' : 'Overdue',
      value: summary?.overdueTasks ?? 0,
      subtitle: isEs ? 'tareas' : 'tasks',
      icon: AlertTriangle,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      borderClass:
        (summary?.overdueTasks ?? 0) > 5
          ? 'border-red-300 dark:border-red-800'
          : (summary?.overdueTasks ?? 0) > 0
            ? 'border-amber-300 dark:border-amber-800'
            : '',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className={cn('border', stat.borderClass)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bg)}>
                <stat.icon className={cn('h-4 w-4', stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {stat.subtitle}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
