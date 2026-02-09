-- ============================================
-- ENABLE RLS ON MANUAL_SECTIONS
-- ============================================
ALTER TABLE public.manual_sections ENABLE ROW LEVEL SECURITY;

-- ============================================
-- MANUAL_SECTIONS POLICIES
-- ============================================

-- All authenticated users can read manual sections
CREATE POLICY "Authenticated users can view manual sections"
  ON public.manual_sections FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert content
CREATE POLICY "Admins can insert manual sections"
  ON public.manual_sections FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update content
CREATE POLICY "Admins can update manual sections"
  ON public.manual_sections FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete content
CREATE POLICY "Admins can delete manual sections"
  ON public.manual_sections FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));