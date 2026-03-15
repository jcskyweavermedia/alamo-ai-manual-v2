-- =============================================================================
-- MIGRATION: Seed position_training_requirements
-- Phase D.2: Link 5 FOH positions to Server 101 for Alamo Prime group
-- =============================================================================

INSERT INTO public.position_training_requirements (group_id, position, program_id, required, due_within_days, sort_order)
SELECT
  g.id,
  pos.position,
  tp.id,
  true,
  30,
  pos.sort_order
FROM public.groups g
CROSS JOIN (VALUES
  ('Server', 1), ('Host', 2), ('Busser', 3), ('Runner', 4), ('Bartender', 5)
) AS pos(position, sort_order)
JOIN public.training_programs tp ON tp.slug = 'server-101' AND tp.group_id = g.id
WHERE g.slug = 'alamo-prime'
ON CONFLICT (group_id, position, program_id) DO NOTHING;
