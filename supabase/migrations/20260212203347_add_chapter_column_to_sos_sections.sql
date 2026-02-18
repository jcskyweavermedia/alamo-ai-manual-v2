-- Add chapter column for explicit chapter grouping
ALTER TABLE steps_of_service_sections ADD COLUMN chapter text;

-- Set chapter for top-level (parent) sections based on sort_order
UPDATE steps_of_service_sections
SET chapter = CASE
  WHEN sort_order BETWEEN 10 AND 120 THEN 'foundations'
  WHEN sort_order BETWEEN 130 AND 190 THEN 'service-flow'
  WHEN sort_order BETWEEN 200 AND 220 THEN 'standards'
  WHEN sort_order BETWEEN 230 AND 250 THEN 'reference'
END
WHERE parent_key IS NULL;

-- Propagate chapter to child sections from their parent
UPDATE steps_of_service_sections child
SET chapter = parent.chapter
FROM steps_of_service_sections parent
WHERE child.parent_key = parent.section_key
  AND child.position = parent.position
  AND child.parent_key IS NOT NULL;

-- Add index for chapter grouping queries
CREATE INDEX idx_sos_sections_chapter ON steps_of_service_sections (chapter) WHERE chapter IS NOT NULL;
