-- Fix: Delete rogue Truffle Mashed Potatoes prep_recipe that appeared as a duplicate on /recipes
-- The /recipes page queries BOTH prep_recipes AND plate_specs.
-- A prep_recipe was ingested at midnight (id: 83227dd1); a plate_spec was published 16h later.
-- The plate_spec references the prep_recipe via prep_recipe_ref in its components JSONB.
-- The prevent_delete_if_referenced_as_sub_recipe trigger guards deletion — clear ref first.
--
-- Safe deletion order:
--   1. Clear prep_recipe_ref across ALL component groups in plate_spec (no title filter needed)
--   2. Delete prep_recipe row (has source_session_id FK → ingestion_sessions)
--   3. Delete ingestion_session

-- Step 1: Clear prep_recipe_ref = 'truffle-mashed-potatoes' across all component groups
UPDATE plate_specs
SET components = (
  SELECT jsonb_agg(
    CASE
      WHEN grp -> 'items' IS NOT NULL THEN
        jsonb_set(
          grp,
          '{items}',
          COALESCE(
            (
              SELECT jsonb_agg(
                CASE
                  WHEN item ->> 'prep_recipe_ref' = 'truffle-mashed-potatoes' THEN
                    (item - 'prep_recipe_ref') || '{"type": "raw"}'::jsonb
                  ELSE item
                END
              )
              FROM jsonb_array_elements(grp -> 'items') AS item
            ),
            '[]'::jsonb
          )
        )
      ELSE grp
    END
  )
  FROM jsonb_array_elements(components) AS grp
)
WHERE id = '158c7b83-d219-4ab0-9fd1-33c63cd5c6c0';

-- Verify the ref is gone before attempting the delete (will raise if still present)
DO $$
DECLARE
  still_refs INT;
BEGIN
  SELECT COUNT(*) INTO still_refs
  FROM plate_specs ps,
       jsonb_array_elements(ps.components) AS grp,
       jsonb_array_elements(grp -> 'items') AS item
  WHERE item ->> 'prep_recipe_ref' = 'truffle-mashed-potatoes';

  IF still_refs > 0 THEN
    RAISE EXCEPTION 'Step 1 did not clear prep_recipe_ref — % reference(s) remain', still_refs;
  END IF;
END;
$$;

-- Step 2: Delete the prep_recipe (source_session_id FK must be gone before session delete)
DELETE FROM prep_recipes
WHERE id = '83227dd1-2631-42bb-9111-a149e4aa6a13'
  AND slug = 'truffle-mashed-potatoes';

-- Step 3: Delete the ingestion session for the prep_recipe
DELETE FROM ingestion_sessions
WHERE id = 'a99cd353-bfeb-4341-9ebe-823dcae08c6a';
