import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Search, X, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppShell } from '@/components/layout/AppShell';
import { useLanguage } from '@/hooks/use-language';
import { useCourseList } from '@/hooks/use-course-list';
import { CoursePlayerCard } from '@/components/course-player/CoursePlayerCard';

// =============================================================================
// BILINGUAL STRINGS
// =============================================================================

const STRINGS = {
  en: {
    heroLine1: 'Learn &',
    heroLine2: 'Grow',
    tagline: 'Browse courses and track your progress.',
    searchPlaceholder: 'Search courses...',
    inProgressLabel: 'IN PROGRESS',
    allCoursesLabel: 'ALL COURSES',
    completedLabel: 'COMPLETED',
    emptyTitle: 'No courses found',
    emptySubtitle: 'Try a different search term.',
    clearSearch: 'Clear Search',
    loadError: 'Failed to load courses',
    noCourses: 'No courses available yet.',
  },
  es: {
    heroLine1: 'Aprende y',
    heroLine2: 'Crece',
    tagline: 'Explora cursos y sigue tu progreso.',
    searchPlaceholder: 'Buscar cursos...',
    inProgressLabel: 'EN PROGRESO',
    allCoursesLabel: 'TODOS LOS CURSOS',
    completedLabel: 'COMPLETADOS',
    emptyTitle: 'No se encontraron cursos',
    emptySubtitle: 'Intenta con otro término de búsqueda.',
    clearSearch: 'Limpiar búsqueda',
    loadError: 'Error al cargar cursos',
    noCourses: 'Aún no hay cursos disponibles.',
  },
} as const;

// =============================================================================
// SKELETON LOADING STATE
// =============================================================================

function CoursesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-[20px] bg-muted h-[260px]"
        />
      ))}
    </div>
  );
}

// =============================================================================
// COURSES PAGE COMPONENT
// =============================================================================

const CoursesPage = () => {
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const t = STRINGS[language];

  const {
    inProgress: inProgressCourses,
    notStarted: notStartedCourses,
    completed: completedCourses,
    coverImageUrls,
    coverImagePaths,
    searchQuery,
    setSearchQuery,
    togglePin,
    isPinned,
    isLoading,
    error,
  } = useCourseList();

  const handleSelect = useCallback(
    (slug: string) => {
      navigate(`/courses/${slug}`);
    },
    [navigate],
  );

  const totalCourses =
    inProgressCourses.length + notStartedCourses.length + completedCourses.length;
  const hasResults = totalCourses > 0;
  const hasInProgress = inProgressCourses.length > 0;
  const hasCompleted = completedCourses.length > 0;

  // ---------------------------------------------------------------------------
  // Header left: search input (matches Forms.tsx pattern)
  // ---------------------------------------------------------------------------

  const headerToolbar = (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 max-w-[240px] min-w-[120px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className={cn(
            'h-9 w-full rounded-lg border border-input bg-background',
            'pl-8 pr-8 text-sm',
            'ring-offset-background transition-colors duration-150',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            '[&::-webkit-search-cancel-button]:hidden',
          )}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Clear search"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <AppShell
      language={language}
      onLanguageChange={setLanguage}
      showSearch={false}
      headerToolbar={headerToolbar}
    >
      {isLoading ? (
        <div className="py-6">
          <CoursesGridSkeleton />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm text-muted-foreground">{t.loadError}</p>
        </div>
      ) : !hasResults && !searchQuery ? (
        /* No courses at all (not searching) */
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="flex items-center justify-center h-14 w-14 rounded-[14px] bg-blue-100 dark:bg-blue-900/30">
            <span className="text-[32px] h-[32px] leading-[32px]">{'\uD83C\uDF93'}</span>
          </div>
          <p className="text-sm text-muted-foreground">{t.noCourses}</p>
        </div>
      ) : (
        <>
          {/* Hero text + graduation cap tile */}
          <div className="py-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-2xl sm:text-3xl text-foreground leading-tight font-extralight">
                {t.heroLine1}
                <br />
                <span className="font-bold">{t.heroLine2}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                {t.tagline}
              </p>
            </div>

            {/* Graduation cap emoji tile */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  'flex items-center justify-center',
                  'w-16 h-16 rounded-[16px]',
                  'bg-blue-100 dark:bg-blue-900/30',
                  'border border-black/[0.04] dark:border-white/[0.06]',
                  'shadow-sm',
                )}
              >
                <span className="text-[32px] h-[32px] leading-[32px]">{'\uD83C\uDF93'}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                {language === 'es' ? 'Cursos' : 'Courses'}
              </span>
            </div>
          </div>

          {/* Search with no results */}
          {!hasResults && searchQuery ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <SearchX className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-base font-medium text-foreground">{t.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{t.emptySubtitle}</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                {t.clearSearch}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* In Progress section */}
              {hasInProgress && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {t.inProgressLabel}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {inProgressCourses.map((course) => (
                      <CoursePlayerCard
                        key={course.slug}
                        course={course}
                        language={language}
                        coverImageUrl={coverImageUrls.get(coverImagePaths.get(course.id) ?? '') ?? undefined}
                        isPinned={isPinned(course.slug)}
                        onTogglePin={togglePin}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* All Courses section (not started) */}
              {notStartedCourses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {t.allCoursesLabel}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {notStartedCourses.map((course) => (
                      <CoursePlayerCard
                        key={course.slug}
                        course={course}
                        language={language}
                        coverImageUrl={coverImageUrls.get(coverImagePaths.get(course.id) ?? '') ?? undefined}
                        isPinned={isPinned(course.slug)}
                        onTogglePin={togglePin}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed section */}
              {hasCompleted && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">
                    {t.completedLabel}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {completedCourses.map((course) => (
                      <CoursePlayerCard
                        key={course.slug}
                        course={course}
                        language={language}
                        coverImageUrl={coverImageUrls.get(coverImagePaths.get(course.id) ?? '') ?? undefined}
                        isPinned={isPinned(course.slug)}
                        onTogglePin={togglePin}
                        onSelect={handleSelect}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
};

export default CoursesPage;
