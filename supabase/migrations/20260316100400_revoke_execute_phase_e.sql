-- =============================================================================
-- MIGRATION: REVOKE EXECUTE on Phase E RPC functions
-- Phase E functions are user-callable (manager/admin via frontend).
-- They have internal role checks. Revoke from anon/public for defense-in-depth.
-- =============================================================================

BEGIN;

-- Phase E functions — revoke from anon and public (keep authenticated)
REVOKE EXECUTE ON FUNCTION public.get_admin_employees(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_employee_detail(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_people_hero_stats(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_hub_hero_stats(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_courses_hero_stats(UUID) FROM anon, public;

-- Ensure authenticated role has EXECUTE (should already be granted, but be explicit)
GRANT EXECUTE ON FUNCTION public.get_admin_employees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_hero_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hub_hero_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_courses_hero_stats(UUID) TO authenticated;

COMMIT;
