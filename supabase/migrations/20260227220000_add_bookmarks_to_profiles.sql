-- Add bookmarks JSONB column to profiles for per-user bookmark sync
-- Shape: { "recipes": ["slug-1"], "courses": ["slug-2"], "forms": [] }

ALTER TABLE profiles
  ADD COLUMN bookmarks JSONB NOT NULL DEFAULT '{}';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_bookmarks_is_object
  CHECK (jsonb_typeof(bookmarks) = 'object');
