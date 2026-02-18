import { cn } from '@/lib/utils';
import type { TeamMemberProgress } from '@/types/dashboard';

interface TeamProgressTableProps {
  members: TeamMemberProgress[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  language: 'en' | 'es';
}

const STATUS_DOT: Record<string, string> = {
  on_track: 'bg-green-500',
  behind: 'bg-amber-500',
  inactive: 'bg-gray-400',
};

const STATUS_LABEL: Record<string, { en: string; es: string }> = {
  on_track: { en: 'On Track', es: 'En curso' },
  behind: { en: 'Behind', es: 'Atrasado' },
  inactive: { en: 'Inactive', es: 'Inactivo' },
};

function formatRelativeTime(dateStr: string | null, language: 'en' | 'es'): string {
  if (!dateStr) return language === 'es' ? 'Nunca' : 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return language === 'es' ? 'Hoy' : 'Today';
  if (days === 1) return language === 'es' ? 'Ayer' : 'Yesterday';
  if (days < 7) return language === 'es' ? `${days}d` : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return language === 'es' ? `${weeks}sem` : `${weeks}w ago`;
}

export function TeamProgressTable({
  members,
  selectedUserId,
  onSelectUser,
  language,
}: TeamProgressTableProps) {
  const isEs = language === 'es';

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_80px] md:grid-cols-[1fr_100px_80px_80px_80px] gap-2 px-3 py-2 bg-muted/50 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <span>{isEs ? 'Nombre' : 'Name'}</span>
        <span className="text-right">{isEs ? 'Progreso' : 'Progress'}</span>
        <span className="hidden md:block text-right">{isEs ? 'Quiz' : 'Quiz Avg'}</span>
        <span className="hidden md:block text-center">{isEs ? 'Estado' : 'Status'}</span>
        <span className="hidden md:block text-right">{isEs ? 'Activo' : 'Active'}</span>
      </div>

      {/* Rows */}
      <div className="divide-y">
        {members.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {isEs ? 'No hay miembros del equipo' : 'No team members'}
          </div>
        )}

        {members.map((member) => (
          <button
            key={member.userId}
            type="button"
            onClick={() => onSelectUser(member.userId)}
            className={cn(
              'w-full grid grid-cols-[1fr_80px] md:grid-cols-[1fr_100px_80px_80px_80px] gap-2 px-3 py-2.5 text-left transition-colors',
              'hover:bg-muted/50 active:bg-muted',
              selectedUserId === member.userId && 'bg-muted'
            )}
          >
            {/* Name + status dot */}
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  STATUS_DOT[member.status]
                )}
              />
              <span className="text-sm truncate">
                {member.fullName || member.email}
              </span>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1.5 justify-end">
              <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${member.overallProgressPercent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">
                {member.overallProgressPercent}%
              </span>
            </div>

            {/* Quiz Avg - tablet+ */}
            <span className="hidden md:block text-xs text-muted-foreground text-right self-center">
              {member.averageQuizScore != null
                ? `${member.averageQuizScore}%`
                : '-'}
            </span>

            {/* Status label - tablet+ */}
            <span
              className={cn(
                'hidden md:block text-[11px] text-center self-center',
                member.status === 'on_track' && 'text-green-600 dark:text-green-400',
                member.status === 'behind' && 'text-amber-600 dark:text-amber-400',
                member.status === 'inactive' && 'text-muted-foreground'
              )}
            >
              {STATUS_LABEL[member.status][language]}
            </span>

            {/* Last Active - tablet+ */}
            <span className="hidden md:block text-xs text-muted-foreground text-right self-center">
              {formatRelativeTime(member.lastActiveAt, language)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
