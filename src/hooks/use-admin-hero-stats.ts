import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGroupId } from '@/hooks/useGroupId';
import { ADMIN_STRINGS } from '@/components/admin-panel/strings';
import type { HeroBannerStat } from '@/types/admin-panel';

type Lang = 'en' | 'es';

export function usePeopleHeroStats(language: Lang) {
  const groupId = useGroupId();
  const [stats, setStats] = useState<HeroBannerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    setIsLoading(true);
    const t = ADMIN_STRINGS[language];
    (supabase.rpc as any)('get_people_hero_stats', { p_group_id: groupId })
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[usePeopleHeroStats]', error.message);
          setIsLoading(false);
          return;
        }
        // RPC returns a single row (or array with one element)
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) { setIsLoading(false); return; }
        setStats([
          { value: row.total_employees ?? 0, label: t.total },
          { value: row.new_hires ?? 0, label: t.newHires },
          { value: row.needs_attention ?? 0, label: t.behind, highlighted: (row.needs_attention ?? 0) > 0 },
          { value: row.fully_trained ?? 0, label: t.trained },
        ]);
        setIsLoading(false);
      });
  }, [groupId, language]);

  return { stats, isLoading };
}

export function useHubHeroStats(language: Lang) {
  const groupId = useGroupId();
  const [stats, setStats] = useState<HeroBannerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    setIsLoading(true);
    (supabase.rpc as any)('get_hub_hero_stats', { p_group_id: groupId })
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[useHubHeroStats]', error.message);
          setIsLoading(false);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) { setIsLoading(false); return; }
        const labels = language === 'es'
          ? { managed: 'Empleados', courses: 'Cursos Activos', pending: 'Acciones Pendientes' }
          : { managed: 'Staff Managed', courses: 'Active Courses', pending: 'Pending Actions' };
        setStats([
          { value: row.staff_managed ?? 0, label: labels.managed },
          { value: row.active_courses ?? 0, label: labels.courses },
          { value: row.pending_actions ?? 0, label: labels.pending, highlighted: (row.pending_actions ?? 0) > 0 },
        ]);
        setIsLoading(false);
      });
  }, [groupId, language]);

  return { stats, isLoading };
}

export function useCoursesHeroStats(language: Lang) {
  const groupId = useGroupId();
  const [stats, setStats] = useState<HeroBannerStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    setIsLoading(true);
    (supabase.rpc as any)('get_courses_hero_stats', { p_group_id: groupId })
      .then(({ data, error }: { data: any; error: any }) => {
        if (error) {
          console.error('[useCoursesHeroStats]', error.message);
          setIsLoading(false);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) { setIsLoading(false); return; }
        const labels = language === 'es'
          ? { total: 'Total Cursos', rate: 'Completados', avg: 'Nota Promedio' }
          : { total: 'Total Courses', rate: 'Completion Rate', avg: 'Avg Grade' };
        setStats([
          { value: row.total_courses ?? 0, label: labels.total },
          { value: `${row.completion_rate ?? 0}%`, label: labels.rate },
          { value: row.avg_grade != null ? Number(row.avg_grade).toFixed(1) : 'N/A', label: labels.avg },
        ]);
        setIsLoading(false);
      });
  }, [groupId, language]);

  return { stats, isLoading };
}
