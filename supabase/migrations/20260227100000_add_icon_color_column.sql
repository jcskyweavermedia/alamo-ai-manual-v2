BEGIN;

-- Add icon_color column (NOT NULL with default)
ALTER TABLE public.form_templates
  ADD COLUMN icon_color TEXT NOT NULL DEFAULT 'blue';

COMMENT ON COLUMN public.form_templates.icon_color IS 'Background color name for emoji icon display';

-- Migrate ALL existing Lucide icon names to emoji
UPDATE public.form_templates SET icon = '📋', icon_color = 'blue'    WHERE icon = 'ClipboardList';
UPDATE public.form_templates SET icon = '📄', icon_color = 'slate'   WHERE icon = 'FileText';
UPDATE public.form_templates SET icon = '⚠️', icon_color = 'red'     WHERE icon = 'AlertTriangle';
UPDATE public.form_templates SET icon = '🌡️', icon_color = 'red'     WHERE icon = 'Thermometer';
UPDATE public.form_templates SET icon = '🛡️', icon_color = 'green'   WHERE icon = 'ShieldCheck';
UPDATE public.form_templates SET icon = '👥', icon_color = 'blue'    WHERE icon = 'Users';
UPDATE public.form_templates SET icon = '🍽️', icon_color = 'amber'   WHERE icon = 'UtensilsCrossed';
UPDATE public.form_templates SET icon = '🩺', icon_color = 'green'   WHERE icon = 'Stethoscope';
UPDATE public.form_templates SET icon = '⚖️', icon_color = 'slate'   WHERE icon = 'Scale';
UPDATE public.form_templates SET icon = '🚚', icon_color = 'blue'    WHERE icon = 'Truck';
UPDATE public.form_templates SET icon = '🕐', icon_color = 'purple'  WHERE icon = 'Clock';
UPDATE public.form_templates SET icon = '⭐', icon_color = 'amber'   WHERE icon = 'Star';
UPDATE public.form_templates SET icon = '❤️', icon_color = 'pink'    WHERE icon = 'Heart';
UPDATE public.form_templates SET icon = '🔥', icon_color = 'orange'  WHERE icon = 'Flame';
UPDATE public.form_templates SET icon = '📖', icon_color = 'blue'    WHERE icon = 'BookOpen';
UPDATE public.form_templates SET icon = '📢', icon_color = 'orange'  WHERE icon = 'Megaphone';
UPDATE public.form_templates SET icon = '✅', icon_color = 'emerald' WHERE icon = 'BadgeCheck';
UPDATE public.form_templates SET icon = '🔧', icon_color = 'gray'    WHERE icon = 'Wrench';
UPDATE public.form_templates SET icon = '🏢', icon_color = 'slate'   WHERE icon = 'Building';
UPDATE public.form_templates SET icon = '📞', icon_color = 'green'   WHERE icon = 'Phone';
UPDATE public.form_templates SET icon = '📅', icon_color = 'purple'  WHERE icon = 'Calendar';
UPDATE public.form_templates SET icon = '☑️', icon_color = 'emerald' WHERE icon = 'CheckSquare';
UPDATE public.form_templates SET icon = '📦', icon_color = 'amber'   WHERE icon = 'Package';
UPDATE public.form_templates SET icon = '🏆', icon_color = 'amber'   WHERE icon = 'Award';
UPDATE public.form_templates SET icon = '⚠️', icon_color = 'red'     WHERE icon = 'FileWarning';
UPDATE public.form_templates SET icon = '💓', icon_color = 'red'     WHERE icon = 'HeartPulse';
UPDATE public.form_templates SET icon = '🌐', icon_color = 'blue'    WHERE icon = 'Globe';
UPDATE public.form_templates SET icon = '🔒', icon_color = 'slate'   WHERE icon = 'Lock';

-- Catch-all: any remaining PascalCase Lucide names -> default
UPDATE public.form_templates
SET icon = '📋', icon_color = 'blue'
WHERE icon ~ '^[A-Z][a-zA-Z]+$';

-- Drop existing function first (return type is changing — can't use CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.search_forms(TEXT, TEXT, INT, UUID);

-- Recreate search_forms function with icon_color in return type
CREATE OR REPLACE FUNCTION public.search_forms(
  search_query      TEXT,
  search_language   TEXT DEFAULT 'en',
  match_count       INT DEFAULT 5,
  p_group_id        UUID DEFAULT NULL
)
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title       TEXT,
  description TEXT,
  icon        TEXT,
  icon_color  TEXT,
  score       FLOAT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query  tsquery;
  ts_config regconfig;
BEGIN
  -- Determine language config
  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  RETURN QUERY
  SELECT
    ft.id,
    ft.slug,
    CASE
      WHEN search_language = 'es' AND ft.title_es IS NOT NULL AND ft.title_es <> ''
        THEN ft.title_es
      ELSE ft.title_en
    END AS title,
    ts_headline(
      ts_config,
      CASE
        WHEN search_language = 'es' AND ft.description_es IS NOT NULL AND ft.description_es <> ''
          THEN ft.description_es
        ELSE COALESCE(ft.description_en, '')
      END,
      ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
    ) AS description,
    ft.icon,
    ft.icon_color,
    ts_rank(ft.search_vector, ts_query)::FLOAT AS score
  FROM public.form_templates ft
  WHERE ft.search_vector @@ ts_query
    AND ft.status = 'published'
    AND (p_group_id IS NULL OR ft.group_id = p_group_id)
  ORDER BY score DESC
  LIMIT match_count;
END;
$$;

COMMIT;
