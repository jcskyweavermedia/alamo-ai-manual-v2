-- Create ai_teachers table
CREATE TABLE IF NOT EXISTS public.ai_teachers (
  id           uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  slug         text UNIQUE NOT NULL,
  name         text NOT NULL,
  description  text,
  category     text NOT NULL CHECK (category IN ('food','wine','beer','liquor','beer_liquor','standards')),
  level        smallint NOT NULL DEFAULT 101,
  avatar_emoji text NOT NULL DEFAULT '🎓',
  prompt_en    text NOT NULL,
  prompt_es    text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE TRIGGER set_ai_teachers_updated_at
  BEFORE UPDATE ON public.ai_teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.ai_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_teachers_select_authenticated"
  ON public.ai_teachers FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "ai_teachers_all_admin"
  ON public.ai_teachers FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
