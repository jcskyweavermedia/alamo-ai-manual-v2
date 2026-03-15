// =============================================================================
// CourseListSidebar — Left sidebar with search, sort, and course cards
// =============================================================================

import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { COURSE_EMOJI, defaultEmoji } from '@/constants/course-emoji';
import type { TrainingCourseItem } from '@/types/dashboard';

const STRINGS = {
  en: {
    search: 'Search courses...',
    recent: 'Recent',
    az: 'A-Z',
    completion: 'Completion',
    enrolled: 'enrolled',
    sections: 'sections',
    noCourses: 'No courses found',
    noCoursesDesc: 'Create a published course to see it here.',
    noResults: 'No matching courses',
  },
  es: {
    search: 'Buscar cursos...',
    recent: 'Recientes',
    az: 'A-Z',
    completion: 'Finalización',
    enrolled: 'inscritos',
    sections: 'secciones',
    noCourses: 'No se encontraron cursos',
    noCoursesDesc: 'Crea un curso publicado para verlo aquí.',
    noResults: 'Sin resultados',
  },
};

type SortKey = 'recent' | 'az' | 'completion';

interface CourseListSidebarProps {
  courses: TrainingCourseItem[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string) => void;
  language: 'en' | 'es';
}

export function CourseListSidebar({
  courses,
  selectedCourseId,
  onSelectCourse,
  language,
}: CourseListSidebarProps) {
  const t = STRINGS[language];
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const filtered = useMemo(() => {
    let list = courses;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => {
        const title = language === 'es' && c.titleEs ? c.titleEs : c.titleEn;
        return title.toLowerCase().includes(q) || c.titleEn.toLowerCase().includes(q);
      });
    }

    const sorted = [...list];
    switch (sortKey) {
      case 'az':
        sorted.sort((a, b) => {
          const aTitle = language === 'es' && a.titleEs ? a.titleEs : a.titleEn;
          const bTitle = language === 'es' && b.titleEs ? b.titleEs : b.titleEn;
          return aTitle.localeCompare(bTitle);
        });
        break;
      case 'completion':
        sorted.sort((a, b) => b.completionPercent - a.completionPercent);
        break;
      // 'recent' keeps the original order (already sorted by most activity)
    }

    return sorted;
  }, [courses, search, sortKey, language]);

  const sortPills: { key: SortKey; label: string }[] = [
    { key: 'recent', label: t.recent },
    { key: 'az', label: t.az },
    { key: 'completion', label: t.completion },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t.search}
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background',
            'pl-9 pr-8 text-sm',
            'ring-offset-background transition-colors duration-150',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Sort pills */}
      <div className="flex gap-1">
        {sortPills.map(pill => (
          <button
            key={pill.key}
            type="button"
            onClick={() => setSortKey(pill.key)}
            className={cn(
              'h-7 px-3 rounded-full text-[11px] font-semibold',
              'transition-all duration-150 active:scale-[0.96]',
              sortKey === pill.key
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Course cards */}
      <div
        className="flex flex-col gap-2 overflow-y-auto lg:max-h-[calc(100vh-360px)]"
        style={{ scrollbarWidth: 'thin' }}
      >
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {courses.length === 0 ? (
              <>
                <p className="font-medium">{t.noCourses}</p>
                <p className="mt-1 text-xs">{t.noCoursesDesc}</p>
              </>
            ) : (
              <p>{t.noResults}</p>
            )}
          </div>
        ) : (
          filtered.map(course => {
            const title = language === 'es' && course.titleEs ? course.titleEs : course.titleEn;
            const emojiConfig = COURSE_EMOJI[course.icon ?? ''] ?? defaultEmoji;
            const isSelected = course.id === selectedCourseId;

            return (
              <button
                key={course.id}
                type="button"
                onClick={() => onSelectCourse(course.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl',
                  'border transition-all duration-150',
                  'hover:bg-muted/30 active:scale-[0.99]',
                  isSelected
                    ? 'border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.12)] bg-orange-50/50 dark:bg-orange-950/20'
                    : 'border-black/[0.04] dark:border-white/[0.06] bg-card',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={cn(
                    'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                    emojiConfig.bg,
                    emojiConfig.darkBg,
                  )}>
                    <span className="text-lg leading-none">{emojiConfig.emoji}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Title + status */}
                    <div className="flex items-start gap-1.5">
                      <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-1 flex-1">
                        {title}
                      </h4>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-[9px] font-bold px-1.5 py-0 border-0 shrink-0',
                          course.status === 'published'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {course.status.toUpperCase()}
                      </Badge>
                    </div>

                    {/* Section count */}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {course.totalSections} {t.sections}
                    </p>

                    {/* Progress bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          course.completionPercent >= 80
                            ? 'bg-green-500'
                            : course.completionPercent >= 50
                              ? 'bg-blue-500'
                              : 'bg-orange-500',
                        )}
                        style={{ width: `${course.completionPercent}%` }}
                      />
                    </div>

                    {/* Footer stats */}
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        {course.enrolledCount} {t.enrolled}
                      </span>
                      <span className="text-[11px] font-semibold text-foreground">
                        {course.completionPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
