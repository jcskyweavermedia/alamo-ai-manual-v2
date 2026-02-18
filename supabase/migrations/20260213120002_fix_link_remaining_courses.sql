-- Fix: link beer-liquor and desserts-after-dinner courses to Server 101 program
-- (seed migration used wrong slugs 'beer-spirits' and 'guest-interaction')
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  SELECT id INTO v_program_id
  FROM public.training_programs
  WHERE slug = 'server-101';

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'server-101 program not found';
  END IF;

  UPDATE public.courses
  SET program_id = v_program_id
  WHERE slug IN ('beer-liquor', 'desserts-after-dinner')
    AND program_id IS NULL;
END $$;
