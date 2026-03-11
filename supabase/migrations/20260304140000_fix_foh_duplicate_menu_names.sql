-- 1a: Delete duplicates, keeping the most recently updated row per menu_name
DELETE FROM public.foh_plate_specs
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY lower(menu_name) ORDER BY updated_at DESC, created_at DESC) AS rn
    FROM public.foh_plate_specs
    WHERE status = 'published'
  ) ranked
  WHERE rn > 1
);

-- 1b: Partial unique index — one published dish guide per menu name
CREATE UNIQUE INDEX idx_foh_plate_specs_unique_menu_name
  ON public.foh_plate_specs (lower(menu_name))
  WHERE status = 'published';
