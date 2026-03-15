-- =============================================================================
-- Rename teacher_level values: personality-based → audience-based
-- Old: friendly, professional, strict, expert
-- New: new_hire, developing, experienced, veteran
-- =============================================================================

-- Step 1: Drop old CHECK constraint FIRST (so UPDATEs don't violate it)
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_teacher_level_check;

-- Step 2: Migrate existing data
UPDATE courses SET teacher_level = 'new_hire'     WHERE teacher_level = 'friendly';
UPDATE courses SET teacher_level = 'developing'   WHERE teacher_level = 'professional';
UPDATE courses SET teacher_level = 'experienced'  WHERE teacher_level = 'strict';
UPDATE courses SET teacher_level = 'veteran'      WHERE teacher_level = 'expert';

-- Step 3: Add new CHECK constraint
ALTER TABLE courses ADD CONSTRAINT courses_teacher_level_check
  CHECK (teacher_level IN ('new_hire', 'developing', 'experienced', 'veteran'));

-- Step 4: Update default
ALTER TABLE courses ALTER COLUMN teacher_level SET DEFAULT 'developing';
