// =============================================================================
// EmployeeRoster -- Employee list for a specific course
// =============================================================================

import { useState, useMemo } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterPillBar } from '@/components/admin-panel/shared/FilterPillBar';
import { EmployeeRow } from '@/components/admin-panel/shared/EmployeeRow';
import { ProgressBar } from '@/components/admin-panel/shared/ProgressBar';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { AdminCourseEmployee } from '@/types/admin-panel';

interface EmployeeRosterProps {
  employees: AdminCourseEmployee[];
  language: 'en' | 'es';
  onEmployeeClick?: (id: string) => void;
}

type StatusFilter = 'All' | 'Completed' | 'In Progress' | 'Not Started' | 'Overdue' | 'Stuck';

function getStatusFilterOptions(language: 'en' | 'es'): StatusFilter[] {
  // Filter pills are always rendered in English for the keys; labels use translations
  return ['All', 'Completed', 'In Progress', 'Not Started', 'Overdue', 'Stuck'];
}

function getFilterLabel(filter: StatusFilter, language: 'en' | 'es'): string {
  const t = ADMIN_STRINGS[language];
  const map: Record<StatusFilter, string> = {
    All: t.all,
    Completed: t.completed,
    'In Progress': t.inProgress,
    'Not Started': t.notStarted,
    Overdue: t.overdue,
    Stuck: t.stuck,
  };
  return map[filter];
}

function matchesFilter(emp: AdminCourseEmployee, filter: StatusFilter): boolean {
  if (filter === 'All') return true;
  const statusMap: Record<StatusFilter, AdminCourseEmployee['status'][]> = {
    All: [],
    Completed: ['completed'],
    'In Progress': ['in_progress'],
    'Not Started': ['not_started'],
    Overdue: ['overdue'],
    Stuck: ['stuck'],
  };
  return statusMap[filter].includes(emp.status);
}

function getStatusBadge(
  emp: AdminCourseEmployee,
  language: 'en' | 'es',
): { text: string; variant: 'new' | 'warning' | 'danger' | 'default' | 'grade' } | undefined {
  const t = ADMIN_STRINGS[language];

  if (emp.status === 'completed' && emp.grade) {
    return { text: `${emp.grade}${emp.score != null ? ` \u00b7 ${emp.score}` : ''}`, variant: 'grade' };
  }
  if (emp.status === 'stuck') {
    return { text: t.stuck, variant: 'warning' };
  }
  if (emp.status === 'overdue') {
    return { text: t.overdue, variant: 'danger' };
  }
  if (emp.status === 'in_progress') {
    return { text: t.inProgress, variant: 'default' };
  }
  if (emp.status === 'not_started') {
    return { text: t.notStarted, variant: 'default' };
  }
  return undefined;
}

function getSubtitle(emp: AdminCourseEmployee, language: 'en' | 'es'): string {
  const t = ADMIN_STRINGS[language];
  if (emp.status === 'completed') {
    return `${emp.position} \u00b7 ${t.completed} ${emp.modulesCompleted}/${emp.modulesTotal} ${t.modules}`;
  }
  if (emp.status === 'in_progress' || emp.status === 'stuck' || emp.status === 'overdue') {
    return `${emp.position} \u00b7 ${emp.modulesCompleted} ${t.of} ${emp.modulesTotal} ${t.modules}`;
  }
  return emp.position;
}

export function EmployeeRoster({
  employees,
  language,
  onEmployeeClick,
}: EmployeeRosterProps) {
  const t = ADMIN_STRINGS[language];
  const [filter, setFilter] = useState<StatusFilter>('All');
  const [search, setSearch] = useState('');

  const filterOptions = getStatusFilterOptions(language);
  const filterLabels = useMemo(
    () => filterOptions.map((f) => getFilterLabel(f, language)),
    [language],
  );

  const filtered = useMemo(() => {
    let result = employees;
    if (filter !== 'All') {
      result = result.filter((e) => matchesFilter(e, filter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.position.toLowerCase().includes(q),
      );
    }
    return result;
  }, [employees, filter, search]);

  const handleFilterSelect = (label: string) => {
    const idx = filterLabels.indexOf(label);
    if (idx >= 0) setFilter(filterOptions[idx]);
  };

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm text-foreground">
            {t.enrolled} ({employees.length})
          </h3>
          <FilterPillBar
            options={filterLabels}
            activeOption={getFilterLabel(filter, language)}
            onSelect={handleFilterSelect}
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.searchPeople}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Employee list */}
      <div className="px-3 pb-3 space-y-0.5">
        {filtered.map((emp) => (
          <EmployeeRow
            key={emp.employeeId}
            name={emp.name}
            initials={emp.initials}
            avatarColor={emp.avatarColor}
            subtitle={getSubtitle(emp, language)}
            badge={getStatusBadge(emp, language)}
            compact
            onClick={onEmployeeClick ? () => onEmployeeClick(emp.employeeId) : undefined}
            rightContent={
              emp.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : emp.status === 'in_progress' ||
                emp.status === 'stuck' ||
                emp.status === 'overdue' ? (
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      'text-xs font-bold tabular-nums',
                      emp.progressPercent >= 80
                        ? 'text-green-600'
                        : emp.progressPercent >= 50
                          ? 'text-foreground'
                          : emp.status === 'overdue'
                            ? 'text-red-600'
                            : emp.status === 'stuck'
                              ? 'text-amber-600'
                              : 'text-foreground',
                    )}
                  >
                    {emp.progressPercent}%
                  </span>
                  <div className="w-16">
                    <ProgressBar
                      value={emp.progressPercent}
                      height={4}
                      colorClass={
                        emp.status === 'overdue'
                          ? 'bg-red-500'
                          : emp.status === 'stuck'
                            ? 'bg-amber-500'
                            : undefined
                      }
                    />
                  </div>
                </div>
              ) : null
            }
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {language === 'en' ? 'No employees match the current filter.' : 'Ningun empleado coincide con el filtro actual.'}
          </p>
        )}
      </div>
    </div>
  );
}
