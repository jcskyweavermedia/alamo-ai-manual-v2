// =============================================================================
// CourseSidebar -- Course list with filter pills and search
// =============================================================================

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FilterPillBar } from '@/components/admin-panel/shared/FilterPillBar';
import { CourseCard } from '@/components/admin-panel/courses/CourseCard';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { AdminCourse, CourseCategory } from '@/types/admin-panel';

interface CourseSidebarProps {
  courses: AdminCourse[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  language: 'en' | 'es';
}

type CategoryFilter = 'All' | CourseCategory;

function getCategoryFilterOptions(language: 'en' | 'es'): { key: CategoryFilter; label: string }[] {
  const t = ADMIN_STRINGS[language];
  return [
    { key: 'All', label: t.allCourses },
    { key: 'New Hire', label: t.newHireCourses },
    { key: 'FOH', label: t.foh },
    { key: 'BOH', label: t.boh },
  ];
}

export function CourseSidebar({
  courses,
  selectedId,
  onSelect,
  language,
}: CourseSidebarProps) {
  const t = ADMIN_STRINGS[language];
  const [filter, setFilter] = useState<CategoryFilter>('All');
  const [search, setSearch] = useState('');

  const filterOptions = useMemo(() => getCategoryFilterOptions(language), [language]);
  const filterLabels = useMemo(() => filterOptions.map((f) => f.label), [filterOptions]);

  const filtered = useMemo(() => {
    let result = courses;
    if (filter !== 'All') {
      result = result.filter((c) => c.category === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.nameEs && c.nameEs.toLowerCase().includes(q)) ||
          c.department.toLowerCase().includes(q),
      );
    }
    return result;
  }, [courses, filter, search]);

  const handleFilterSelect = (label: string) => {
    const opt = filterOptions.find((f) => f.label === label);
    if (opt) setFilter(opt.key);
  };

  const activeLabel = filterOptions.find((f) => f.key === filter)?.label ?? filterLabels[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder={t.searchCourses}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-border bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Filter pills */}
      <FilterPillBar
        options={filterLabels}
        activeOption={activeLabel}
        onSelect={handleFilterSelect}
      />

      {/* Course list */}
      <div
        className="flex flex-col gap-2 overflow-y-auto pr-0.5"
        style={{ maxHeight: 'calc(100vh - 300px)' }}
      >
        {filtered.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            isSelected={selectedId === course.id}
            onClick={() => onSelect(course.id)}
            language={language}
          />
        ))}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {language === 'en'
              ? 'No courses match the current filter.'
              : 'Ningun curso coincide con el filtro actual.'}
          </p>
        )}
      </div>
    </div>
  );
}
