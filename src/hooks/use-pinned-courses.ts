import { usePinned } from '@/hooks/use-pinned';

export function usePinnedCourses() {
  return usePinned('courses');
}
