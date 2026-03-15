// =============================================================================
// AllStaffCard -- Searchable/filterable staff list
// =============================================================================

import { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { EmployeeRow } from '@/components/admin-panel/shared/EmployeeRow';
import { FilterPillBar } from '@/components/admin-panel/shared/FilterPillBar';
import type { AdminEmployee } from '@/types/admin-panel';

interface AllStaffCardProps {
  employees: AdminEmployee[];
  language: 'en' | 'es';
  onEmployeeClick?: (id: string) => void;
}

const ROLE_FILTERS_EN = ['All', 'Server', 'Host', 'Busser', 'Runner', 'Cook', 'Bartender'];
const ROLE_FILTERS_ES = ['Todos', 'Mesero', 'Anfitrión', 'Busser', 'Runner', 'Cocinero', 'Bartender'];

/** Map display filter label back to the position value used in data */
function matchesRole(emp: AdminEmployee, filter: string): boolean {
  if (filter === 'All' || filter === 'Todos') return true;
  const pos = emp.position.toLowerCase();
  const f = filter.toLowerCase();
  // Handle "Cook" / "Cocinero" matching "Line Cook"
  if (f === 'cook' || f === 'cocinero') return pos.includes('cook');
  // Handle Spanish "Anfitrión" matching English position "Host"
  if (f === 'anfitrión' || f === 'anfitrion') return pos === 'host';
  // Handle Spanish "Mesero" matching English position "Server"
  if (f === 'mesero') return pos === 'server';
  return pos === f || pos.startsWith(f);
}

export function AllStaffCard({ employees, language, onEmployeeClick }: AllStaffCardProps) {
  const t = ADMIN_STRINGS[language];
  const roleFilters = language === 'en' ? ROLE_FILTERS_EN : ROLE_FILTERS_ES;

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(roleFilters[0]);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch =
        !search || emp.name.toLowerCase().includes(search.toLowerCase());
      const matchesFilterRole = matchesRole(emp, activeFilter);
      return matchesSearch && matchesFilterRole;
    });
  }, [employees, search, activeFilter]);

  return (
    <div className="bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
            <Users className="h-4 w-4 text-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t.allStaff}</h3>
            <p className="text-xs text-muted-foreground">
              {employees.length} {t.employees}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-3 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchStaff}
            className={cn(
              'w-full h-9 pl-9 pr-3 rounded-lg border border-black/[0.06] dark:border-white/[0.08]',
              'bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-orange-500/30',
            )}
          />
        </div>

        {/* Filter pills */}
        <FilterPillBar
          options={roleFilters}
          activeOption={activeFilter}
          onSelect={setActiveFilter}
        />
      </div>

      {/* Body -- scrollable list */}
      <div className="max-h-[320px] overflow-y-auto pb-2">
        {filtered.map((emp) => (
          <EmployeeRow
            key={emp.id}
            compact
            name={emp.name}
            initials={emp.initials}
            avatarColor={emp.avatarColor}
            subtitle={`${emp.position} \u00B7 ${emp.tenureLabel}`}
            badge={emp.grade ? { text: emp.grade, variant: 'grade' } : undefined}
            onClick={onEmployeeClick ? () => onEmployeeClick(emp.id) : undefined}
            rightContent={
              emp.coursesDone ? (
                <span className="text-xs text-muted-foreground">
                  {emp.coursesDone} {t.courses}
                </span>
              ) : null
            }
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            {language === 'en' ? 'No employees found' : 'No se encontraron empleados'}
          </p>
        )}
      </div>
    </div>
  );
}
