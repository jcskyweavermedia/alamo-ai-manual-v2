-- =============================================================================
-- Bump admin daily AI limit from 100 to 500 for dev/testing.
-- Course builds use multiple AI calls (outline + pass1 + pass2×N sections),
-- so 100/day is too restrictive during active development.
-- Also reset today's daily counter so the user can keep testing immediately.
-- =============================================================================

-- Bump admin daily limit
UPDATE public.role_policies
SET daily_ai_limit = 500
WHERE role = 'admin';

-- Reset today's daily counter for all admins (dev convenience)
DELETE FROM public.usage_counters
WHERE period_type = 'daily'
  AND period_start = CURRENT_DATE;
