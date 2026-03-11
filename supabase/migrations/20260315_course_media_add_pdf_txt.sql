-- =============================================================================
-- Add PDF + TXT MIME types to course-media storage bucket
-- Also tighten file_size_limit from 50MB to 10MB (matches frontend validation)
-- Enables attachment uploads for the Course Wizard
-- =============================================================================

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/webp','image/gif','video/mp4',
    'application/pdf','text/plain'
  ],
  file_size_limit = 10485760  -- 10 MB (was 50 MB)
WHERE id = 'course-media';
