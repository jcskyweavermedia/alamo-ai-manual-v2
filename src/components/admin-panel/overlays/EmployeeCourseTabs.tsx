// =============================================================================
// EmployeeCourseTabs -- Tab bar for switching between courses + AI Analysis
// =============================================================================

import {
  Sparkles,
  Check,
  Utensils,
  DoorOpen,
  ShieldAlert,
  Wine,
  Flame,
  Beef,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminEmployeeCourse } from '@/types/admin-panel';
import { ADMIN_STRINGS } from '../strings';

// ---------------------------------------------------------------------------
// Icon map — resolve string icon name to Lucide component
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  DoorOpen,
  ShieldAlert,
  Wine,
  Flame,
  Beef,
  BookOpen,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeCourseTabsProps {
  courses: AdminEmployeeCourse[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  language: 'en' | 'es';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeCourseTabs({
  courses,
  activeTab,
  onTabChange,
  language,
}: EmployeeCourseTabsProps) {
  const t = ADMIN_STRINGS[language];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-5">
      {/* Course tabs in a muted pill container */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted flex-1">
        {courses.map((course) => {
          const isActive = activeTab === course.courseId;
          const isNotStarted = course.status === 'not_started' || course.status === 'locked';
          const isCompleted = course.status === 'completed';
          const Icon = ICON_MAP[course.courseIcon] ?? BookOpen;

          return (
            <button
              key={course.courseId}
              type="button"
              onClick={() => onTabChange(course.courseId)}
              className={cn(
                'px-4 py-2 text-sm rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap',
                isActive &&
                  'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-sm',
                !isActive && 'text-muted-foreground hover:text-foreground',
                isNotStarted && !isActive && 'opacity-50',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {course.courseName}
              {isCompleted && !isActive && (
                <Check className="h-3 w-3 ml-0.5 text-green-500" />
              )}
              {!isCompleted && course.progressPercent > 0 && (
                <span className="text-xs ml-1 opacity-60 tabular-nums">
                  {course.progressPercent}%
                </span>
              )}
              {isNotStarted && (
                <span className="text-xs ml-1 opacity-60">--</span>
              )}
            </button>
          );
        })}
      </div>

      {/* AI Analysis tab — separate from the pill container */}
      <div className="flex-shrink-0 ml-1">
        <button
          type="button"
          onClick={() => onTabChange('ai')}
          className={cn(
            'px-4 py-2 text-sm rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap border',
            activeTab === 'ai'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold shadow-sm border-transparent'
              : 'border-orange-500/30 text-orange-500 font-semibold',
          )}
        >
          <Sparkles
            className="h-3.5 w-3.5"
            style={
              activeTab !== 'ai'
                ? { filter: 'drop-shadow(0 0 4px rgba(249,115,22,0.5))' }
                : undefined
            }
          />
          {t.aiAnalysis}
        </button>
      </div>
    </div>
  );
}
