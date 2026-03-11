-- Add ui_preferences column to profiles for cross-device sidebar state sync
ALTER TABLE profiles
  ADD COLUMN ui_preferences JSONB NOT NULL DEFAULT '{}';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_ui_preferences_is_object
  CHECK (jsonb_typeof(ui_preferences) = 'object');

COMMENT ON COLUMN profiles.ui_preferences IS
  'Per-user UI state. Shape: { sidebar_groups: { boh: bool, foh: bool, learn: bool, forms: bool, admin: bool }, sidebar_collapsed: bool }';
