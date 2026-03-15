// =============================================================================
// EnrolledTab — All enrolled employees grouped by role
// =============================================================================

import { useMemo } from 'react';
import { CheckCircle2, Loader, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrainingEmployee } from '@/types/dashboard';
import { getInitials, getAvatarColor, formatShortDate } from './utils';

const STRINGS = {
  en: {
    enrolled: 'Enrolled',
    noEmployees: 'No employees enrolled yet',
    noEmployeesDesc: 'Employees will appear here once they enroll in this course.',
  },
  es: {
    enrolled: 'Inscrito',
    noEmployees: 'No hay empleados inscritos',
    noEmployeesDesc: 'Los empleados aparecerán aquí una vez que se inscriban en este curso.',
  },
};

interface EnrolledTabProps {
  employees: TrainingEmployee[];
  language: 'en' | 'es';
  isLoading: boolean;
}

function getStatusIcon(emp: TrainingEmployee) {
  if (emp.enrollmentStatus === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  // struggling = in_progress but less than 30% and active for a while
  if (
    emp.enrollmentStatus === 'in_progress' &&
    emp.progressPercent < 30 &&
    emp.completedSections > 0
  ) {
    return <AlertCircle className="h-4 w-4 text-amber-500" />;
  }
  if (emp.enrollmentStatus === 'in_progress') {
    return <Loader className="h-4 w-4 text-orange-500" />;
  }
  return <Loader className="h-4 w-4 text-muted-foreground" />;
}

export function EnrolledTab({ employees, language, isLoading }: EnrolledTabProps) {
  const t = STRINGS[language];

  // Group by role
  const groupedByRole = useMemo(() => {
    const groups = new Map<string, TrainingEmployee[]>();
    for (const emp of employees) {
      const role = emp.role || 'staff';
      const existing = groups.get(role) ?? [];
      existing.push(emp);
      groups.set(role, existing);
    }
    // Sort each group by name
    for (const [, emps] of groups) {
      emps.sort((a, b) => (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email));
    }
    // Sort roles: servers, managers, admin, staff, other
    const roleOrder = ['staff', 'manager', 'admin'];
    return [...groups.entries()].sort(([a], [b]) => {
      const ai = roleOrder.indexOf(a);
      const bi = roleOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [employees]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-28 bg-muted rounded" />
              <div className="h-2 w-20 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <p className="text-sm font-medium text-muted-foreground">{t.noEmployees}</p>
        <p className="text-xs text-muted-foreground mt-1">{t.noEmployeesDesc}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {groupedByRole.map(([role, emps]) => (
        <div key={role}>
          {/* Role header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {role === 'staff' ? 'SERVERS' : role.toUpperCase()}
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              · {emps.length}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {emps.map(emp => {
              const name = emp.fullName || emp.email;
              const initials = getInitials(emp.fullName || emp.email);
              const avatarBg = getAvatarColor(emp.userId);

              return (
                <div
                  key={emp.enrollmentId}
                  className="flex items-center gap-3 p-3 rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-card"
                >
                  {/* Avatar */}
                  <div className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
                    avatarBg,
                  )}>
                    {initials}
                  </div>

                  {/* Name + enrolled date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.enrolled} {formatShortDate(emp.startedAt)}
                    </p>
                  </div>

                  {/* Status icon */}
                  <div className="shrink-0">
                    {getStatusIcon(emp)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
