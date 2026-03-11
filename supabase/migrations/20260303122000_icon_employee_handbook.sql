-- ============================================
-- ICONS: Employee Handbook sections
-- Uses Lucide icon names (same pattern as existing sections)
-- ============================================

BEGIN;

-- Category folder icon
UPDATE public.manual_sections SET icon = 'BookUser'       WHERE slug = 'employee-handbook';

-- Child section icons
UPDATE public.manual_sections SET icon = 'BookOpen'       WHERE slug = 'employee-handbook-overview';
UPDATE public.manual_sections SET icon = 'Clock'          WHERE slug = 'attendance-punctuality';
UPDATE public.manual_sections SET icon = 'ThumbsUp'       WHERE slug = 'professional-conduct';
UPDATE public.manual_sections SET icon = 'Shirt'          WHERE slug = 'dress-code-appearance';
UPDATE public.manual_sections SET icon = 'CalendarDays'   WHERE slug = 'time-off-vacation';
UPDATE public.manual_sections SET icon = 'TrendingUp'     WHERE slug = 'performance-standards';
UPDATE public.manual_sections SET icon = 'AlertTriangle'  WHERE slug = 'disciplinary-policy';

COMMIT;
