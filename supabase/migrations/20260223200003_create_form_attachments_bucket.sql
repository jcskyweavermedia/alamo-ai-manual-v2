-- =============================================================================
-- MIGRATION: create_form_attachments_bucket
-- Creates Supabase Storage bucket for form attachments (signatures, photos,
-- documents) + RLS policies for authenticated access
-- Phase 1 of Form Builder System
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- BUCKET: form-attachments (PRIVATE — signatures and injury photos are PII)
-- Use createSignedUrl() for display (1-hour expiry)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'form-attachments',
  'form-attachments',
  false,                                                          -- PRIVATE: signed URLs required
  10485760,                                                       -- 10 MB max
  ARRAY['image/jpeg','image/png','image/webp','application/pdf']  -- Photos, signatures, PDFs only
);

-- ---------------------------------------------------------------------------
-- RLS: Authenticated users can upload files
-- ---------------------------------------------------------------------------

CREATE POLICY "Authenticated users can upload form attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-attachments');

-- ---------------------------------------------------------------------------
-- RLS: Authenticated users can read files
-- ---------------------------------------------------------------------------

CREATE POLICY "Authenticated users can read form attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'form-attachments');

-- ---------------------------------------------------------------------------
-- RLS: Users can update their own uploaded files
-- ---------------------------------------------------------------------------

CREATE POLICY "Users can update own form attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-attachments' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'form-attachments' AND owner = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: Admins can delete any form attachment
-- ---------------------------------------------------------------------------

CREATE POLICY "Admins can delete form attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'form-attachments'
    AND has_role(auth.uid(), 'admin'::user_role)
  );

COMMIT;
