-- Add 'batch' to ingestion_sessions ingestion_method CHECK constraint
-- Uses pg_constraint lookup to find the actual constraint name (safe on Supabase)
DO $$
DECLARE
  _name text;
BEGIN
  SELECT c.conname INTO _name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
   WHERE n.nspname = 'public'
     AND t.relname = 'ingestion_sessions'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%ingestion_method%';

  IF _name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ingestion_sessions DROP CONSTRAINT %I', _name);
  END IF;
END
$$;

ALTER TABLE public.ingestion_sessions
  ADD CONSTRAINT ingestion_sessions_ingestion_method_check
  CHECK (ingestion_method IN ('chat','file_upload','image_upload','edit','batch'));
