-- Add teacher_id FK to courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.ai_teachers(id) ON DELETE SET NULL;

-- Auto-assign 101 teachers based on the dominant content_source across each course's sections
WITH course_source AS (
  SELECT
    course_id,
    content_source,
    COUNT(*) AS cnt,
    ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY COUNT(*) DESC) AS rn
  FROM public.course_sections
  WHERE status = 'published'
  GROUP BY course_id, content_source
),
dominant AS (
  SELECT course_id, content_source
  FROM course_source
  WHERE rn = 1
),
teacher_map AS (
  SELECT course_id,
    CASE content_source
      WHEN 'foh_plate_specs'  THEN 'food-101'
      WHEN 'prep_recipes'     THEN 'food-101'
      WHEN 'plate_specs'      THEN 'food-101'
      WHEN 'wines'            THEN 'wine-101'
      WHEN 'cocktails'        THEN 'beer-liquor-101'
      WHEN 'beer_liquor_list' THEN 'beer-liquor-101'
      WHEN 'manual_sections'  THEN 'standards-101'
      WHEN 'custom'           THEN 'standards-101'
      ELSE                         'standards-101'
    END AS teacher_slug
  FROM dominant
)
UPDATE public.courses c
  SET teacher_id = (SELECT id FROM public.ai_teachers WHERE slug = tm.teacher_slug)
  FROM teacher_map tm
  WHERE c.id = tm.course_id
    AND c.teacher_id IS NULL;

-- Index for FK lookups
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON public.courses(teacher_id);
