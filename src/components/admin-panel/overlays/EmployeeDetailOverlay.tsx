// =============================================================================
// EmployeeDetailOverlay -- Full-screen Radix Dialog for employee detail
// Renders: OverlayHeader (sticky) + course tabs + active panel content
// =============================================================================

import { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { DialogOverlay } from '@/components/ui/dialog';
import type { AdminEmployee } from '@/types/admin-panel';
import { EmployeeOverlayHeader } from './EmployeeOverlayHeader';
import { EmployeeCourseTabs } from './EmployeeCourseTabs';
import { EmployeeCoursePanel } from './EmployeeCoursePanel';
import { EmployeeAIAnalysisPanel } from './EmployeeAIAnalysisPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployeeDetailOverlayProps {
  employee: AdminEmployee | null;
  isOpen: boolean;
  onClose: () => void;
  backLabel?: string; // e.g. "Our Team" or "Server 101"
  language: 'en' | 'es';
  isLoading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployeeDetailOverlay({
  employee,
  isOpen,
  onClose,
  backLabel = 'Our Team',
  language,
  isLoading = false,
}: EmployeeDetailOverlayProps) {
  // Default to first course tab if available, otherwise 'ai'
  const [activeTab, setActiveTab] = useState<string>('');

  // Reset tab when employee changes
  useEffect(() => {
    if (employee && employee.courses.length > 0) {
      // Default to the first in-progress course, or just the first course
      const inProgress = employee.courses.find((c) => c.status === 'in_progress');
      setActiveTab(inProgress?.courseId ?? employee.courses[0].courseId);
    } else if (employee) {
      setActiveTab('ai');
    }
  }, [employee]);

  // Loading state — show skeleton inside dialog
  if (isLoading && !employee) {
    return (
      <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogPrimitive.Portal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed inset-[3%] z-50 max-w-none rounded-[20px] p-0 overflow-y-auto border bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">
              {language === 'es' ? 'Cargando...' : 'Loading...'}
            </DialogPrimitive.Title>
            <div className="p-8 space-y-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-4 w-32 bg-muted rounded" />
                </div>
              </div>
              <div className="h-8 w-64 bg-muted rounded" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="h-64 bg-muted rounded-2xl" />
                <div className="h-64 bg-muted rounded-2xl" />
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  if (!employee) return null;

  const activeCourse = employee.courses.find((c) => c.courseId === activeTab);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed inset-[3%] z-50 max-w-none rounded-[20px] p-0 overflow-y-auto border bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby={undefined}
        >
          {/* Accessible title (visually hidden) */}
          <DialogPrimitive.Title className="sr-only">
            {employee.name} Detail
          </DialogPrimitive.Title>

          {/* Sticky header + employee info */}
          <EmployeeOverlayHeader
            employee={employee}
            backLabel={backLabel}
            onClose={onClose}
            language={language}
          />

          {/* Body: tabs + panel */}
          <div className="max-w-screen-xl mx-auto px-6 pb-6">
            {/* Course tabs (or no-courses message) */}
            {employee.courses.length > 0 ? (
              <EmployeeCourseTabs
                courses={employee.courses}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                language={language}
              />
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {language === 'es'
                  ? 'No hay cursos inscritos aún.'
                  : 'No courses enrolled yet.'}
              </div>
            )}

            {/* Active panel */}
            {activeTab === 'ai' ? (
              <EmployeeAIAnalysisPanel employee={employee} language={language} />
            ) : activeCourse ? (
              <EmployeeCoursePanel
                course={activeCourse}
                employee={employee}
                language={language}
              />
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
