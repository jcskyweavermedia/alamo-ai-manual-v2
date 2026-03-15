// =============================================================================
// Shared status badge styles for course cards.
// Single source of truth — used by AdminCourseListPage and CourseCardPreview.
// =============================================================================

export const statusBadgeStyles: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  published: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  outline: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  generating: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  review: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  prose_ready: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};
