// =============================================================================
// CoursesView -- Full layout for the Courses tab
// =============================================================================

import { useState, useMemo, useCallback } from 'react';
import { GraduationCap, BookOpen } from 'lucide-react';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import { useAdminCourses } from '@/hooks/use-admin-courses';
import { useCoursesHeroStats } from '@/hooks/use-admin-hero-stats';
import { HeroBanner } from '@/components/admin-panel/HeroBanner';
import { CourseSidebar } from '@/components/admin-panel/courses/CourseSidebar';
import { CourseDetailPanel } from '@/components/admin-panel/courses/CourseDetailPanel';
import { EmployeeModuleDrilldown } from '@/components/admin-panel/courses/EmployeeModuleDrilldown';
import type { AdminModuleResult } from '@/types/admin-panel';

interface CoursesViewProps {
  language: 'en' | 'es';
  onEmployeeClick?: (employeeId: string) => void;
}

export function CoursesView({ language, onEmployeeClick }: CoursesViewProps) {
  const t = ADMIN_STRINGS[language];

  const { courses, isLoading: coursesLoading } = useAdminCourses();
  const { stats: heroStats } = useCoursesHeroStats(language);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) ?? null,
    [selectedCourseId, courses],
  );

  // When an employee is clicked in the roster, look up their data from the course enrollment
  const drilldownData = useMemo(() => {
    if (!selectedCourse || !selectedEmployeeId) return null;

    const courseEmployee = selectedCourse.enrolledEmployees.find(
      (e) => e.employeeId === selectedEmployeeId,
    );
    if (!courseEmployee) return null;

    // Module drilldown data is not available without full employee detail
    // Return employee info only -- modules will be empty
    return {
      employee: courseEmployee,
      modules: [] as AdminModuleResult[],
      aiInsight: undefined as string | undefined,
    };
  }, [selectedCourse, selectedEmployeeId]);

  const handleCourseSelect = useCallback((id: string) => {
    setSelectedCourseId(id);
    setSelectedEmployeeId(null); // Reset employee selection when course changes
  }, []);

  const handleEmployeeClickInRoster = useCallback(
    (employeeId: string) => {
      setSelectedEmployeeId(employeeId);
      // Also forward to parent if provided
      onEmployeeClick?.(employeeId);
    },
    [onEmployeeClick],
  );

  // Loading skeleton
  if (coursesLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-32 bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  // Empty state
  if (courses.length === 0 && !coursesLoading) {
    return (
      <div className="space-y-5">
        <HeroBanner
          icon={GraduationCap}
          title={t.courses}
          subtitle={
            language === 'en'
              ? 'Track every course.'
              : 'Rastrea cada curso.'
          }
          stats={heroStats}
        />
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {language === 'en' ? 'No courses published yet' : 'No hay cursos publicados'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <HeroBanner
        icon={GraduationCap}
        title={t.courses}
        subtitle={
          language === 'en'
            ? 'Knowledge is the secret ingredient. Track every course.'
            : 'El conocimiento es el ingrediente secreto. Rastrea cada curso.'
        }
        stats={heroStats}
      />

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        {/* Left: Course sidebar */}
        <CourseSidebar
          courses={courses}
          selectedId={selectedCourseId}
          onSelect={handleCourseSelect}
          language={language}
        />

        {/* Right: Detail or placeholder */}
        {selectedCourse ? (
          <div className="space-y-4">
            <CourseDetailPanel
              course={selectedCourse}
              language={language}
              onEmployeeClick={handleEmployeeClickInRoster}
            />

            {/* Employee module drilldown */}
            {drilldownData && (
              <EmployeeModuleDrilldown
                employee={drilldownData.employee}
                modules={drilldownData.modules}
                aiInsight={drilldownData.aiInsight}
                language={language}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[400px] bg-card rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
            <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {t.selectCourse}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t.selectCourseDesc}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
