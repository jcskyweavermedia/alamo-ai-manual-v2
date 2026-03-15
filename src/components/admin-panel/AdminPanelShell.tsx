// =============================================================================
// AdminPanelShell — 3-tab shell: Our Team | Courses | AI Hub
// Persists active tab via ?view= search param
// =============================================================================

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { ADMIN_STRINGS } from './strings';
import { PeopleView } from './people/PeopleView';
import { CoursesView } from './courses/CoursesView';
import { AIHubView } from './hub/AIHubView';
import { NotificationBell } from './notifications/NotificationBell';
import { EmployeeDetailOverlay } from './overlays/EmployeeDetailOverlay';
import type { AdminEmployee } from '@/types/admin-panel';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ViewKey = 'people' | 'courses' | 'hub';

interface AdminPanelShellProps {
  language: 'en' | 'es';
}

// -----------------------------------------------------------------------------
// Tab configuration
// -----------------------------------------------------------------------------

const TABS: { key: ViewKey; icon: typeof Users; labelKey: keyof (typeof ADMIN_STRINGS)['en'] }[] = [
  { key: 'people', icon: Users, labelKey: 'ourTeam' },
  { key: 'courses', icon: GraduationCap, labelKey: 'courses' },
  { key: 'hub', icon: Sparkles, labelKey: 'aiHub' },
];

const VALID_VIEWS = new Set<ViewKey>(['people', 'courses', 'hub']);

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function AdminPanelShell({ language }: AdminPanelShellProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const t = ADMIN_STRINGS[language];
  const { isAdmin, isManager } = useAuth();
  const showNotifications = isAdmin || isManager;

  // Employee detail overlay state
  const [selectedEmployee, setSelectedEmployee] = useState<AdminEmployee | null>(null);
  const [overlayBackLabel, setOverlayBackLabel] = useState('');
  const [overlayLoading, setOverlayLoading] = useState(false);

  // Derive active view from URL, default to 'people'
  const rawView = searchParams.get('view') as ViewKey | null;
  const parsedView: ViewKey = rawView && VALID_VIEWS.has(rawView) ? rawView : 'people';

  // Staff users cannot access the AI Hub tab — redirect to 'people'
  const activeView: ViewKey =
    parsedView === 'hub' && !isAdmin && !isManager ? 'people' : parsedView;

  // Filter tabs: hide AI Hub from staff users
  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === 'hub') return isAdmin || isManager;
    return true;
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTabChange = useCallback(
    (view: ViewKey) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('view', view);
        return next;
      });
    },
    [setSearchParams],
  );

  const handleEmployeeClick = useCallback(
    async (employeeId: string) => {
      setOverlayBackLabel(activeView === 'courses' ? t.courses : t.ourTeam);
      setOverlayLoading(true);

      try {
        const { data, error } = await (supabase.rpc as any)('get_employee_detail', {
          p_employee_id: employeeId,
        });

        if (error) {
          console.error('[AdminPanelShell] get_employee_detail error:', error.message);
          setOverlayLoading(false);
          return;
        }

        // RPC may return array or single row
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setOverlayLoading(false);
          return;
        }

        // Map to AdminEmployee shape
        const firstName = row.first_name ?? '';
        const lastName = row.last_name ?? '';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();

        // Deterministic avatar color
        const AVATAR_COLORS = [
          'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600',
          'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
        ];
        let hash = 0;
        for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
        const avatarColor = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];

        // Map courses JSONB
        const courses = (row.courses ?? []).map((c: any) => ({
          courseId: c.courseId ?? c.course_id ?? '',
          courseName: c.courseName ?? c.course_name ?? '',
          courseIcon: c.courseIcon ?? c.course_icon ?? 'GraduationCap',
          status: c.status ?? 'not_started',
          score: c.score != null ? Number(c.score) : undefined,
          grade: c.grade ?? undefined,
          progressPercent: c.progressPercent ?? c.progress_percent ?? 0,
          modulesCompleted: c.modulesCompleted ?? c.modules_completed ?? 0,
          modulesTotal: c.modulesTotal ?? c.modules_total ?? 0,
          completedDate: c.completedDate ?? c.completed_date ?? undefined,
          modules: (c.modules ?? []).map((m: any) => ({
            id: m.id ?? '',
            name: m.name ?? '',
            status: m.status ?? 'locked',
            score: m.score != null ? Number(m.score) : undefined,
            attempts: m.attempts ?? undefined,
            completedDate: m.completedDate ?? m.completed_date ?? undefined,
          })),
        }));

        const emp: AdminEmployee = {
          id: row.id ?? employeeId,
          name: `${firstName} ${lastName.charAt(0)}.`.trim(),
          initials,
          position: (row.position ?? 'Server') as any,
          department: (row.department ?? 'FOH') as any,
          avatarColor,
          hireDate: row.hire_date ?? '',
          tenureLabel: row.tenure_label ?? 'N/A',
          isNewHire: row.is_new_hire ?? false,
          needsAttention: row.needs_attention ?? false,
          attentionReason: row.attention_reason as any,
          currentCourse: row.current_course ?? undefined,
          courseProgress: row.course_progress ?? undefined,
          overallProgress: row.overall_progress ?? 0,
          grade: row.grade ?? undefined,
          coursesDone: row.courses_done ?? undefined,
          avgScore: row.avg_score != null ? Number(row.avg_score) : undefined,
          courses,
        };

        setSelectedEmployee(emp);
      } catch (err) {
        console.error('[AdminPanelShell] Unexpected error:', err);
      } finally {
        setOverlayLoading(false);
      }
    },
    [activeView, t],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="relative flex justify-center items-center px-4 pt-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
          {visibleTabs.map(({ key, icon: Icon, labelKey }) => {
            const isActive = activeView === key;
            const isAiHub = key === 'hub';

            return (
              <button
                key={key}
                onClick={() => handleTabChange(key)}
                className={cn(
                  'px-4 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap',
                  isActive && !isAiHub &&
                    'bg-foreground text-background font-semibold shadow-sm',
                  isActive && isAiHub &&
                    'bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold shadow-sm',
                  !isActive &&
                    'text-muted-foreground font-medium hover:text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />
                {t[labelKey]}
              </button>
            );
          })}
        </div>

        {/* Notification bell — right side, manager/admin only */}
        {showNotifications && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <NotificationBell language={language} />
          </div>
        )}
      </div>

      {/* Active view */}
      {activeView === 'people' && (
        <PeopleView language={language} onEmployeeClick={handleEmployeeClick} />
      )}

      {activeView === 'courses' && (
        <CoursesView language={language} onEmployeeClick={handleEmployeeClick} />
      )}

      {activeView === 'hub' && (
        <AIHubView language={language} />
      )}

      {/* Employee Detail Overlay */}
      <EmployeeDetailOverlay
        employee={selectedEmployee}
        isOpen={selectedEmployee !== null || overlayLoading}
        onClose={() => { setSelectedEmployee(null); setOverlayLoading(false); }}
        backLabel={overlayBackLabel}
        language={language}
      />
    </div>
  );
}
