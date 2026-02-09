-- Allow unauthenticated users to view active groups by slug for the join flow
-- This is required so new users can see the group name before signing up

CREATE POLICY "Anyone can view active groups by slug"
  ON public.groups FOR SELECT
  TO anon, authenticated
  USING (is_active = true);