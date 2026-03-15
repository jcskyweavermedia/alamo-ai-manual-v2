import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGroupId } from '@/hooks/useGroupId';
import type { AdminEmployee } from '@/types/admin-panel';

// Deterministic avatar color from initials
const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-purple-600',
  'bg-rose-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-teal-600',
  'bg-orange-600', 'bg-pink-600',
];

function getAvatarColor(initials: string): string {
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function useAdminEmployees() {
  const groupId = useGroupId();
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;

    setIsLoading(true);
    (supabase.rpc as any)('get_admin_employees', { p_group_id: groupId })
      .then(({ data, error: rpcError }: { data: any; error: any }) => {
        if (rpcError) {
          console.error('[useAdminEmployees]', rpcError.message);
          setError(rpcError.message);
          setIsLoading(false);
          return;
        }

        const mapped: AdminEmployee[] = (data ?? []).map((row: any) => {
          const firstName = row.first_name ?? '';
          const lastName = row.last_name ?? '';
          const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase();
          return {
            id: row.id,
            name: `${firstName} ${lastName.charAt(0)}.`.trim(),
            initials,
            position: (row.position ?? 'Server') as any,
            department: (row.department ?? 'FOH') as any,
            avatarColor: getAvatarColor(initials),
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
            courses: [], // list view doesn't need full course data
          };
        });

        setEmployees(mapped);
        setIsLoading(false);
      });
  }, [groupId]);

  return { employees, isLoading, error };
}
