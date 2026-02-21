-- Make product-assets bucket public so getPublicUrl() URLs work.
-- These are food product photos — no sensitive data.
UPDATE storage.buckets SET public = true WHERE id = 'product-assets';
