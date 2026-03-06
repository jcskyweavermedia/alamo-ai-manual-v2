# Course Builder -- Database Phases

> Comprehensive phased database plan for the Course Builder rebuild.
> All 14 existing training tables are dropped and rebuilt from scratch.
> New `section_chunks` table adds dual-layer search.
> Designed for dependency order: teardown first, then foundation, then dependent tables.

---

## ⚠️ Master Plan Alignment (Updated 2026-03-05)

> This sub-plan was written BEFORE the owner's design decisions were finalized. The **master-implementation-plan.md** is the authoritative document. The following alignment notes indicate where this sub-plan diverges and what takes precedence at build time.

### Phase Mapping (DB phases → Master Plan phases)

| DB Phase | Maps to Master Plan | Key Difference |
|----------|-------------------|----------------|
| DB-1: Teardown | **Phase 2** | Same content. Migration filename should use `20260306` prefix, not `20260305`. |
| DB-2: Section Chunks | **Phase 7** (NOT Phase 2) | Master plan DEFERS chunks to Phase 7. Core course tables come first. `get_full_sections()` moves to Phase 2. `section_chunks` + `search_chunks()` move to Phase 7. |
| DB-3: Core Course Tables | **Phase 2** | Same content. Runs immediately after teardown, not after chunks. |
| DB-4: Enrollment & Progress | **Phase 5** | Same content. |
| DB-5: Quiz & Assessment | **Phase 5** | Same content. |
| DB-6: Rollouts, Evaluations & Changes | Split: **Phase 6** (change tracking) + **Phase 8** (rollouts, evaluations) | `content_change_log` + change detection → Phase 6. `rollouts`, `rollout_assignments`, `evaluations` → Phase 8. |
| DB-7: Storage & Prompts | **Phase 2** | Runs with teardown/foundation, not last. |

### Missing from This Sub-Plan (Added in Master Plan)

| Item | Master Plan Phase | Notes |
|------|------------------|-------|
| `element_rebuild_log` table | Phase 6 | Per-element rebuild audit trail. Tracks: element_key, course_id, section_id, trigger_source, old/new hash, quiz_questions_regenerated, review_status. |
| Credit cost seeds migration | Phase 2 | `20260306100400_cb_credit_costs.sql` — 11 credit cost entries for `course_builder` + `course_player` domains. |
| `detect_element_changes()` function | Phase 6 | **Element-level** change detection (walks elements JSONB → source_refs per element). Replaces section-level `detect_content_changes()`. |
| Change detection triggers | Phase 6 | `fn_log_content_change()` trigger on all 7 source tables (manual_sections, foh_plate_specs, etc.) |

### Key Design Changes (Owner Decisions)

1. **Rebuilds are element-level, NOT full-course** — `detect_content_changes()` must walk `course_sections.elements` JSONB → check each element's `source_refs[]` individually, NOT just section-level `source_refs`.
2. **Rebuilds are admin-triggered, NOT automatic** — no auto-rebuild in change detection functions. Triggers log changes; admin clicks "Rebuild Affected Elements".
3. **`course_change_log` renamed to `element_rebuild_log`** — tracks per-element rebuild details, not course-level.
4. **Chunks are Phase 7, not Phase 2** — build the Course Builder first with `get_full_sections()`, add chunks later for search optimization.
5. **Storage bucket and AI prompts are Phase 2** — needed at foundation, not deferred to last.

### Migration Filename Convention

All filenames should use `20260306` prefix (not `20260305`) to match master plan convention.

---

## Table of Contents

1. [Phase DB-1: Teardown](#phase-db-1-teardown)
2. [Phase DB-2: Section Chunks (Dual-Layer Search)](#phase-db-2-section-chunks)
3. [Phase DB-3: Core Course Tables](#phase-db-3-core-course-tables)
4. [Phase DB-4: Enrollment & Progress Tables](#phase-db-4-enrollment--progress)
5. [Phase DB-5: Quiz & Assessment Tables](#phase-db-5-quiz--assessment)
6. [Phase DB-6: Rollouts, Evaluations & Change Detection](#phase-db-6-rollouts-evaluations--change-detection)
7. [Phase DB-7: Storage Bucket & AI Prompts](#phase-db-7-storage-bucket--ai-prompts)
8. [Migration File Summary](#migration-file-summary)
9. [Verification Queries](#verification-queries)

---

## Existing Tables to Drop (14 total)

These are all the training-related tables created across multiple migrations that will be removed:

| # | Table | Created In |
|---|-------|-----------|
| 1 | `course_conversations` | `20260213100001` |
| 2 | `conversation_messages` | `20260218170452` |
| 3 | `module_test_answers` | `20260216200000` |
| 4 | `module_test_attempts` | `20260216200000` |
| 5 | `tutor_sessions` | `20260216200000` |
| 6 | `quiz_attempt_answers` | `20260213100001` |
| 7 | `quiz_attempts` | `20260213100001` |
| 8 | `quiz_questions` | `20260213100001` |
| 9 | `evaluations` | `20260213100001` |
| 10 | `section_progress` | `20260213100001` |
| 11 | `rollout_assignments` | `20260213100001` |
| 12 | `rollouts` | `20260213100001` |
| 13 | `course_enrollments` | `20260213100001` |
| 14 | `course_sections` | `20260213100001` |
| 15 | `courses` | `20260213100001` |
| 16 | `program_enrollments` | `20260213120000` |
| 17 | `training_programs` | `20260213120000` |
| 18 | `content_change_log` | `20260213100001` |

> **Note**: `ai_teachers` and `ai_prompts` are **PRESERVED** -- they serve the broader AI system.

### Functions to Drop

| Function | Reason |
|----------|--------|
| `sync_program_enrollment_on_course_complete()` | References old `courses` / `program_enrollments` |
| `cleanup_expired_training_data()` | References old tables; will be recreated |
| `expire_rollouts()` | References old `rollouts` / `rollout_assignments` |
| `detect_content_changes()` | References old `course_sections.content_ids` pattern |
| `get_team_progress()` | References old enrollment/progress schema |

### Cron Jobs to Remove

| Job | Schedule |
|-----|----------|
| `cleanup-training-data` | `0 2 * * *` (daily 2AM) |

---

## Phase DB-1: Teardown

**Goal**: Drop all 18 existing training tables, their dependent functions, triggers, cron jobs, and seed data. Clean slate.

**Migration**: `20260305100000_cb_phase1_teardown.sql`

**Why first**: Everything else depends on a clean namespace. FK chains require dropping in reverse dependency order.

### Drop Order (FK-safe, leaf tables first)

```sql
-- =============================================================================
-- Course Builder Phase DB-1: Teardown
-- Drops all 18 existing training tables + dependent functions + cron jobs
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Remove cron job FIRST (references cleanup function)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('cleanup-training-data');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop functions that reference training tables
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.sync_program_enrollment_on_course_complete() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_training_data() CASCADE;
DROP FUNCTION IF EXISTS public.expire_rollouts() CASCADE;
DROP FUNCTION IF EXISTS public.detect_content_changes(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_team_progress(UUID) CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop tables in reverse FK dependency order
--    Leaf tables (no dependents) first, root tables (depended upon) last
-- ─────────────────────────────────────────────────────────────────────────────

-- Tier 4: Deepest leaf tables
DROP TABLE IF EXISTS public.conversation_messages CASCADE;
DROP TABLE IF EXISTS public.module_test_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_attempt_answers CASCADE;

-- Tier 3: Tables that only tier-4 depends on
DROP TABLE IF EXISTS public.module_test_attempts CASCADE;
DROP TABLE IF EXISTS public.quiz_attempts CASCADE;
DROP TABLE IF EXISTS public.tutor_sessions CASCADE;

-- Tier 2: Mid-level tables
DROP TABLE IF EXISTS public.quiz_questions CASCADE;
DROP TABLE IF EXISTS public.evaluations CASCADE;
DROP TABLE IF EXISTS public.section_progress CASCADE;
DROP TABLE IF EXISTS public.course_conversations CASCADE;
DROP TABLE IF EXISTS public.rollout_assignments CASCADE;
DROP TABLE IF EXISTS public.content_change_log CASCADE;
DROP TABLE IF EXISTS public.program_enrollments CASCADE;

-- Tier 1: Tables that tier-2/3 depends on
DROP TABLE IF EXISTS public.rollouts CASCADE;
DROP TABLE IF EXISTS public.course_enrollments CASCADE;
DROP TABLE IF EXISTS public.course_sections CASCADE;

-- Tier 0: Root tables
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.training_programs CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Clean up orphaned AI prompt seed data (training-specific prompts)
--    Keep assessment-conductor and conversation-evaluator for rebuild
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM public.ai_prompts
WHERE slug IN (
  'training-section-quiz-mc',
  'training-section-quiz-voice',
  'training-session-summary',
  'module-test-mc',
  'module-test-voice',
  'cert-test-mc-generator',
  'cert-test-voice-generator'
);
```

**Validation after migration**:
- `SELECT count(*) FROM information_schema.tables WHERE table_name IN ('courses','course_sections','course_enrollments','section_progress','course_conversations','quiz_questions','quiz_attempts','quiz_attempt_answers','evaluations','rollouts','rollout_assignments','content_change_log','training_programs','program_enrollments','conversation_messages','module_test_attempts','module_test_answers','tutor_sessions')` = 0
- `ai_teachers` table still exists with all rows intact
- `ai_prompts` table still exists (assessment-conductor, conversation-evaluator preserved)

---

## Phase DB-2: Section Chunks (Dual-Layer Search)

**Goal**: Create the `section_chunks` table, chunking trigger function, FTS trigger, and chunk-level search function. Prerequisite for Course Builder source material assembly.

**Migrations**:
- `20260305100100_cb_phase2_create_section_chunks.sql`
- `20260305100200_cb_phase2_chunk_search_function.sql`

### Table: `section_chunks`

```sql
-- =============================================================================
-- Course Builder Phase DB-2a: section_chunks table
-- Search-optimized chunks of manual_sections content (300-800 words each)
-- =============================================================================

CREATE TABLE public.section_chunks (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.manual_sections(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  chunk_index INTEGER NOT NULL DEFAULT 0,  -- Order within section (0, 1, 2, ...)
  heading TEXT,                             -- The heading this chunk falls under

  content_en TEXT NOT NULL DEFAULT '',
  content_es TEXT DEFAULT '',

  -- FTS vectors (auto-populated by trigger)
  search_vector_en TSVECTOR,
  search_vector_es TSVECTOR,

  -- Embeddings (populated by edge function: embed-chunks)
  embedding_en vector(1536),
  embedding_es vector(1536),

  -- Metadata
  word_count_en INTEGER GENERATED ALWAYS AS (
    array_length(regexp_split_to_array(trim(content_en), '\s+'), 1)
  ) STORED,
  word_count_es INTEGER GENERATED ALWAYS AS (
    CASE WHEN content_es IS NOT NULL AND content_es != ''
      THEN array_length(regexp_split_to_array(trim(content_es), '\s+'), 1)
      ELSE 0
    END
  ) STORED,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(section_id, chunk_index)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- FK lookup
CREATE INDEX idx_section_chunks_section ON public.section_chunks(section_id, chunk_index);
CREATE INDEX idx_section_chunks_group ON public.section_chunks(group_id);

-- GIN for FTS
CREATE INDEX idx_section_chunks_fts_en ON public.section_chunks USING GIN(search_vector_en);
CREATE INDEX idx_section_chunks_fts_es ON public.section_chunks USING GIN(search_vector_es);

-- HNSW for vector search (m=16, ef_construction=64 -- project standard)
CREATE INDEX idx_section_chunks_hnsw_en ON public.section_chunks
  USING hnsw (embedding_en vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_section_chunks_hnsw_es ON public.section_chunks
  USING hnsw (embedding_es vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ─────────────────────────────────────────────────────────────────────────────
-- FTS trigger (auto-populate search vectors on INSERT/UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_section_chunk_search_vectors()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Weight: heading = A, content = B
  NEW.search_vector_en :=
    setweight(to_tsvector('english', coalesce(NEW.heading, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.content_en, '')), 'B');

  NEW.search_vector_es :=
    setweight(to_tsvector('spanish', coalesce(NEW.heading, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.content_es, NEW.content_en, '')), 'B');

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_section_chunks_fts
  BEFORE INSERT OR UPDATE ON public.section_chunks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_section_chunk_search_vectors();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: section_chunks
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.section_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chunks in their group"
  ON public.section_chunks FOR SELECT
  TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert chunks"
  ON public.section_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update chunks"
  ON public.section_chunks FOR UPDATE
  TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  )
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Admins can delete chunks"
  ON public.section_chunks FOR DELETE
  TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() = 'admin'
  );
```

### Function: `search_chunks` (hybrid RRF on section_chunks)

```sql
-- =============================================================================
-- Course Builder Phase DB-2b: Chunk-level hybrid search
-- Replaces search_manual_v2 as the primary Q&A search function
-- Uses section_chunks for focused embeddings instead of full manual_sections
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_chunks(
  search_query      TEXT,
  query_embedding   vector(1536),
  search_language   TEXT DEFAULT 'en',
  result_limit      INT DEFAULT 8,
  keyword_weight    FLOAT DEFAULT 0.4,
  vector_weight     FLOAT DEFAULT 0.6,
  p_group_id        UUID DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  section_id      UUID,
  slug            TEXT,
  heading         TEXT,
  snippet         TEXT,
  category        TEXT,
  tags            TEXT[],
  combined_score  FLOAT,
  chunk_index     INTEGER
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ts_query    tsquery;
  ts_config   regconfig;
  v_group_id  UUID;
BEGIN
  -- Resolve group_id
  v_group_id := COALESCE(p_group_id, public.get_user_group_id());

  IF search_language = 'es' THEN
    ts_config := 'spanish'::regconfig;
  ELSE
    ts_config := 'english'::regconfig;
  END IF;

  ts_query := plainto_tsquery(ts_config, search_query);

  RETURN QUERY
  WITH kw AS (
    SELECT
      sc.id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(
        CASE WHEN search_language = 'es' THEN sc.search_vector_es ELSE sc.search_vector_en END,
        ts_query
      ) DESC) AS pos
    FROM public.section_chunks sc
    WHERE sc.group_id = v_group_id
      AND CASE WHEN search_language = 'es'
        THEN sc.search_vector_es
        ELSE sc.search_vector_en
      END @@ ts_query
    LIMIT result_limit * 2
  ),
  kw_stats AS (
    SELECT COUNT(*)::INT AS hit_count FROM kw
  ),
  vec AS (
    SELECT
      sc.id,
      ROW_NUMBER() OVER (
        ORDER BY CASE WHEN search_language = 'es'
          THEN sc.embedding_es
          ELSE sc.embedding_en
        END <=> query_embedding
      ) AS pos
    FROM public.section_chunks sc
    WHERE sc.group_id = v_group_id
      AND CASE WHEN search_language = 'es'
        THEN sc.embedding_es IS NOT NULL
        ELSE sc.embedding_en IS NOT NULL
      END
    LIMIT result_limit * 2
  ),
  combined AS (
    SELECT
      COALESCE(kw.id, vec.id) AS chunk_id,
      -- Adaptive: if FTS returns 0 hits, give 100% to vector
      CASE WHEN (SELECT hit_count FROM kw_stats) = 0
        THEN 0.0
        ELSE COALESCE(keyword_weight / (60.0 + kw.pos), 0.0)
      END
      + COALESCE(
          CASE WHEN (SELECT hit_count FROM kw_stats) = 0
            THEN 1.0 / (60.0 + vec.pos)
            ELSE vector_weight / (60.0 + vec.pos)
          END,
          0.0
        ) AS score
    FROM kw
    FULL OUTER JOIN vec ON kw.id = vec.id
  )
  SELECT
    sc.id,
    sc.section_id,
    ms.slug,
    sc.heading,
    ts_headline(
      ts_config::TEXT,
      CASE WHEN search_language = 'es' THEN sc.content_es ELSE sc.content_en END,
      ts_query,
      'MaxWords=50, MinWords=20, StartSel=**, StopSel=**'
    ) AS snippet,
    ms.category,
    ms.tags,
    c.score AS combined_score,
    sc.chunk_index
  FROM combined c
  JOIN public.section_chunks sc ON sc.id = c.chunk_id
  JOIN public.manual_sections ms ON ms.id = sc.section_id
  ORDER BY c.score DESC
  LIMIT result_limit;
END;
$$;

-- Keep search_manual_v2 available for backward compatibility
-- It still works on full manual_sections for course building source assembly
```

### Function: `get_full_sections` (for Course Builder source material)

```sql
-- Returns complete section content by ID array (for Course Builder)
-- No chunking, no truncation -- the AI gets everything
CREATE OR REPLACE FUNCTION public.get_full_sections(
  section_ids UUID[]
)
RETURNS TABLE (
  id          UUID,
  slug        TEXT,
  title_en    TEXT,
  title_es    TEXT,
  content_en  TEXT,
  content_es  TEXT,
  category    TEXT,
  tags        TEXT[],
  word_count_en INTEGER,
  word_count_es INTEGER,
  updated_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    ms.id, ms.slug, ms.title_en, ms.title_es,
    ms.content_en, ms.content_es,
    ms.category, ms.tags,
    ms.word_count_en, ms.word_count_es,
    ms.updated_at
  FROM public.manual_sections ms
  WHERE ms.id = ANY(section_ids)
    AND ms.is_category = false
  ORDER BY ms.sort_order;
$$;
```

**Validation**:
- `SELECT count(*) FROM section_chunks` should be 0 after table creation (populated by edge function later)
- FTS trigger fires on test insert
- HNSW indexes created
- `search_chunks()` returns empty (no data yet)

---

## Phase DB-3: Core Course Tables

**Goal**: Create the rebuilt `training_programs`, `courses`, and `course_sections` tables. These are the authoring tables that the Course Builder writes to.

**Migration**: `20260305100300_cb_phase3_core_course_tables.sql`

### Table: `training_programs` (rebuilt)

```sql
CREATE TABLE public.training_programs (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  cover_image TEXT,           -- URL for program card
  category TEXT NOT NULL DEFAULT 'fundamentals'
    CHECK (category IN ('fundamentals', 'advanced', 'specialty', 'onboarding', 'certification')),
  icon TEXT,                  -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('published', 'draft', 'archived', 'coming_soon')),

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_training_programs_group_status ON public.training_programs(group_id, status);
CREATE INDEX idx_training_programs_sort ON public.training_programs(group_id, sort_order);
```

### Table: `courses` (rebuilt around element-based architecture)

```sql
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.training_programs(id) ON DELETE SET NULL,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT,
  description_es TEXT,

  -- Builder metadata
  course_type TEXT NOT NULL DEFAULT 'custom'
    CHECK (course_type IN (
      'menu_rollout', 'sop_review', 'steps_of_service',
      'line_cook', 'custom', 'blank'
    )),
  wizard_config JSONB,       -- Saved wizard inputs for rebuilds

  -- Teacher configuration
  teacher_level TEXT NOT NULL DEFAULT 'professional'
    CHECK (teacher_level IN ('friendly', 'professional', 'strict', 'expert')),
  teacher_id UUID REFERENCES public.ai_teachers(id) ON DELETE SET NULL,

  -- Quiz configuration (course-level defaults)
  quiz_config JSONB NOT NULL DEFAULT '{
    "quiz_mode": "multiple_choice",
    "question_count": 10,
    "question_pool_size": 30,
    "passing_score": 70,
    "max_attempts": null,
    "cooldown_minutes": 30,
    "shuffle_questions": true,
    "shuffle_options": true
  }'::jsonb,

  -- Display
  icon TEXT,
  cover_image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 30,

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  published_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'outline', 'generating', 'review', 'published', 'archived')),

  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(group_id, slug)
);

CREATE INDEX idx_courses_group_status ON public.courses(group_id, status);
CREATE INDEX idx_courses_sort ON public.courses(group_id, sort_order);
CREATE INDEX idx_courses_program ON public.courses(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_courses_type ON public.courses(course_type);
```

### Table: `course_sections` (rebuilt with JSONB elements)

This is the critical table. Each section (lesson) stores its content as a JSONB array of elements.

```sql
CREATE TABLE public.course_sections (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_es TEXT,
  description_en TEXT DEFAULT '',
  description_es TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 5,

  -- The element array (the core of the Course Builder)
  -- Array of CourseElement objects: content, feature, media
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- CHECK: elements must be a JSON array
  CONSTRAINT course_sections_elements_is_array
    CHECK (jsonb_typeof(elements) = 'array'),

  -- Source material references (which DB records were used)
  -- Array of {table: string, id: string, content_hash: string}
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Section type
  section_type TEXT NOT NULL DEFAULT 'lesson'
    CHECK (section_type IN ('overview', 'lesson', 'quiz', 'summary')),

  -- Generation status
  generation_status TEXT NOT NULL DEFAULT 'empty'
    CHECK (generation_status IN ('empty', 'outline', 'generating', 'generated', 'reviewed')),

  -- AI instructions (course-builder-level instructions for this section)
  ai_instructions TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(course_id, slug)
);

CREATE INDEX idx_course_sections_course ON public.course_sections(course_id, sort_order);
CREATE INDEX idx_course_sections_group ON public.course_sections(group_id);
-- GIN index on elements for JSONB queries (e.g., finding elements by key)
CREATE INDEX idx_course_sections_elements ON public.course_sections USING GIN(elements);
-- GIN index on source_refs for change detection queries
CREATE INDEX idx_course_sections_source_refs ON public.course_sections USING GIN(source_refs);
```

### Triggers

```sql
-- updated_at triggers
CREATE TRIGGER trg_training_programs_updated_at
  BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_sections_updated_at
  BEFORE UPDATE ON public.course_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### RLS Policies

```sql
-- ─── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_sections ENABLE ROW LEVEL SECURITY;

-- ─── training_programs ───────────────────────────────────────────────────────
CREATE POLICY "Users can view programs in their group"
  ON public.training_programs FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id() AND status IN ('published', 'coming_soon'));

-- Managers also see drafts
CREATE POLICY "Managers can view all programs in their group"
  ON public.training_programs FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can insert programs"
  ON public.training_programs FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update programs"
  ON public.training_programs FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete programs"
  ON public.training_programs FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── courses ─────────────────────────────────────────────────────────────────
-- Staff see published courses; managers/admins see all statuses
CREATE POLICY "Users can view published courses"
  ON public.courses FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id() AND status IN ('published', 'archived'));

CREATE POLICY "Managers can view all courses"
  ON public.courses FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can insert courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── course_sections ─────────────────────────────────────────────────────────
CREATE POLICY "Users can view published course sections"
  ON public.course_sections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
        AND c.status IN ('published', 'archived')
    )
  );

CREATE POLICY "Managers can view all course sections"
  ON public.course_sections FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can insert course sections"
  ON public.course_sections FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can update course sections"
  ON public.course_sections FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can delete course sections"
  ON public.course_sections FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.courses c WHERE c.id = course_sections.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );
```

**Validation**:
- 3 tables created: `training_programs`, `courses`, `course_sections`
- `courses.quiz_config` defaults to valid JSONB
- `course_sections.elements` enforced as JSONB array
- All RLS policies active (15 policies across 3 tables)

---

## Phase DB-4: Enrollment & Progress

**Goal**: Create rebuilt enrollment and progress tracking tables. These are needed by the Course Player.

**Migration**: `20260305100400_cb_phase4_enrollment_progress.sql`

### Table: `course_enrollments` (rebuilt)

```sql
CREATE TABLE public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed', 'expired')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Progress tracking
  total_sections INTEGER NOT NULL DEFAULT 0,
  completed_sections INTEGER NOT NULL DEFAULT 0,

  -- Final assessment
  final_score INTEGER CHECK (final_score IS NULL OR (final_score >= 0 AND final_score <= 100)),
  final_passed BOOLEAN,

  -- Version tracking (which course version was completed)
  course_version INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, course_id)
);

CREATE INDEX idx_course_enrollments_user ON public.course_enrollments(user_id, status);
CREATE INDEX idx_course_enrollments_course ON public.course_enrollments(course_id, status);
CREATE INDEX idx_course_enrollments_group ON public.course_enrollments(group_id);
CREATE INDEX idx_course_enrollments_expiry ON public.course_enrollments(expires_at)
  WHERE expires_at IS NOT NULL;
```

### Table: `section_progress` (rebuilt)

```sql
CREATE TABLE public.section_progress (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.course_sections(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),

  -- Element-level progress (which elements have been viewed/interacted with)
  elements_viewed TEXT[] DEFAULT '{}',  -- Array of element keys
  elements_total INTEGER NOT NULL DEFAULT 0,

  -- Quiz results (if section has quiz)
  quiz_score INTEGER CHECK (quiz_score IS NULL OR (quiz_score >= 0 AND quiz_score <= 100)),
  quiz_passed BOOLEAN,
  quiz_attempts INTEGER NOT NULL DEFAULT 0,

  -- Time tracking
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  -- Content versioning (detect stale completions)
  content_hash_at_completion TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, section_id)
);

CREATE INDEX idx_section_progress_user ON public.section_progress(user_id, status);
CREATE INDEX idx_section_progress_section ON public.section_progress(section_id);
CREATE INDEX idx_section_progress_enrollment ON public.section_progress(enrollment_id);
```

### Table: `program_enrollments` (rebuilt)

```sql
CREATE TABLE public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  total_courses INTEGER NOT NULL DEFAULT 0,
  completed_courses INTEGER NOT NULL DEFAULT 0,
  overall_score INTEGER CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, program_id)
);

CREATE INDEX idx_program_enrollments_user ON public.program_enrollments(user_id, status);
CREATE INDEX idx_program_enrollments_program ON public.program_enrollments(program_id, status);
```

### Table: `course_conversations` (rebuilt)

```sql
CREATE TABLE public.course_conversations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,

  -- Chat messages: [{ role, content, timestamp, metadata? }]
  messages JSONB NOT NULL DEFAULT '[]',

  -- AI-generated summary
  session_summary TEXT,
  topics_discussed TEXT[] DEFAULT '{}',

  -- Flagging
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flagged_by UUID REFERENCES public.profiles(id),
  flagged_at TIMESTAMPTZ,
  flagged_reason TEXT,

  -- Auto-expiry (90 days unless flagged)
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days'),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_conversations_user ON public.course_conversations(user_id);
CREATE INDEX idx_course_conversations_section ON public.course_conversations(section_id);
CREATE INDEX idx_course_conversations_course ON public.course_conversations(course_id);
CREATE INDEX idx_course_conversations_expiry ON public.course_conversations(expires_at)
  WHERE is_flagged = false;
```

### Triggers & RLS

```sql
-- updated_at
CREATE TRIGGER trg_course_enrollments_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_section_progress_updated_at
  BEFORE UPDATE ON public.section_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_program_enrollments_updated_at
  BEFORE UPDATE ON public.program_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_course_conversations_updated_at
  BEFORE UPDATE ON public.course_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_conversations ENABLE ROW LEVEL SECURITY;

-- ─── course_enrollments RLS ──────────────────────────────────────────────────
CREATE POLICY "Users can view own enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group enrollments"
  ON public.course_enrollments FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND group_id = public.get_user_group_id()
  );

CREATE POLICY "Users can self-enroll"
  ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id = public.get_user_group_id()
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_enrollments.course_id
        AND c.group_id = public.get_user_group_id()
        AND c.status = 'published'
    )
  );

CREATE POLICY "Managers can create enrollments"
  ON public.course_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND group_id = public.get_user_group_id()
  );

CREATE POLICY "Users can update own enrollments"
  ON public.course_enrollments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can update enrollments"
  ON public.course_enrollments FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND group_id = public.get_user_group_id()
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND group_id = public.get_user_group_id()
  );

-- ─── section_progress RLS ────────────────────────────────────────────────────
CREATE POLICY "Users can view own progress"
  ON public.section_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group progress"
  ON public.section_progress FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = section_progress.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own progress"
  ON public.section_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress"
  ON public.section_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── program_enrollments RLS ─────────────────────────────────────────────────
CREATE POLICY "Users can view own program enrollments"
  ON public.program_enrollments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  );

CREATE POLICY "Users can enroll in published programs"
  ON public.program_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id = public.get_user_group_id()
    AND EXISTS (
      SELECT 1 FROM public.training_programs tp
      WHERE tp.id = program_id AND tp.status = 'published'
        AND tp.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can update own program enrollment"
  ON public.program_enrollments FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR (
      group_id = public.get_user_group_id()
      AND public.get_user_role() IN ('manager', 'admin')
    )
  );

-- ─── course_conversations RLS ────────────────────────────────────────────────
CREATE POLICY "Users can view own conversations"
  ON public.course_conversations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group conversations"
  ON public.course_conversations FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own conversations"
  ON public.course_conversations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
  ON public.course_conversations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can flag conversations"
  ON public.course_conversations FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = course_conversations.user_id
        AND gm.group_id = public.get_user_group_id()
    )
  );
```

### Auto-Sync Trigger: Program Enrollment

```sql
-- Rebuild the program enrollment auto-sync trigger
CREATE OR REPLACE FUNCTION public.sync_program_enrollment_on_course_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_id UUID;
  v_total_courses INTEGER;
  v_completed_courses INTEGER;
BEGIN
  IF NEW.completed_sections IS NOT DISTINCT FROM OLD.completed_sections THEN
    RETURN NEW;
  END IF;

  IF NEW.completed_sections < NEW.total_sections OR NEW.total_sections = 0 THEN
    RETURN NEW;
  END IF;

  SELECT c.program_id INTO v_program_id
  FROM public.courses c WHERE c.id = NEW.course_id;

  IF v_program_id IS NULL THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_total_courses
  FROM public.courses c
  WHERE c.program_id = v_program_id AND c.status = 'published';

  SELECT count(*) INTO v_completed_courses
  FROM public.course_enrollments ce
  JOIN public.courses c ON c.id = ce.course_id
  WHERE ce.user_id = NEW.user_id
    AND c.program_id = v_program_id
    AND ce.completed_sections >= ce.total_sections
    AND ce.total_sections > 0;

  INSERT INTO public.program_enrollments (user_id, program_id, group_id, status, started_at, total_courses, completed_courses)
  VALUES (
    NEW.user_id, v_program_id, NEW.group_id,
    CASE WHEN v_completed_courses >= v_total_courses THEN 'completed' ELSE 'in_progress' END,
    now(), v_total_courses, v_completed_courses
  )
  ON CONFLICT (user_id, program_id) DO UPDATE SET
    completed_courses = EXCLUDED.completed_courses,
    total_courses = EXCLUDED.total_courses,
    status = CASE WHEN EXCLUDED.completed_courses >= EXCLUDED.total_courses THEN 'completed' ELSE 'in_progress' END,
    completed_at = CASE WHEN EXCLUDED.completed_courses >= EXCLUDED.total_courses THEN now() ELSE NULL END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_program_on_course_update
  AFTER UPDATE ON public.course_enrollments
  FOR EACH ROW
  WHEN (NEW.completed_sections IS DISTINCT FROM OLD.completed_sections)
  EXECUTE FUNCTION public.sync_program_enrollment_on_course_complete();
```

**Validation**: 4 tables created, ~25 RLS policies, 4 triggers, 1 auto-sync function

---

## Phase DB-5: Quiz & Assessment Tables

**Goal**: Create the rebuilt quiz question pool, attempts, and answers tables. The new quiz system supports multiple choice, voice response, and interactive AI modes.

**Migration**: `20260305100500_cb_phase5_quiz_assessment.sql`

### Table: `quiz_questions` (rebuilt with pool management)

```sql
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  question_type TEXT NOT NULL
    CHECK (question_type IN ('multiple_choice', 'voice', 'interactive_ai')),

  question_en TEXT NOT NULL,
  question_es TEXT,

  -- For multiple choice
  options JSONB,  -- [{id, text_en, text_es, correct: boolean}]

  -- For voice questions
  rubric JSONB,   -- [{criterion, points, description}]

  -- For interactive AI
  scenario_en TEXT,  -- Role-play scenario description
  scenario_es TEXT,
  evaluation_criteria JSONB,  -- [{criterion, weight, description}]

  difficulty TEXT DEFAULT 'medium'
    CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Source tracking (which element/content generated this question)
  source_element_key TEXT,   -- element key in course_sections.elements
  source_refs JSONB DEFAULT '[]',  -- [{table, id, content_hash}]

  -- Pool management
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,  -- Archived when content changes

  -- Analytics
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  auto_flagged BOOLEAN NOT NULL DEFAULT false,  -- >70% miss rate after 10+ shows

  source TEXT NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'manual')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_questions_course ON public.quiz_questions(course_id, is_active)
  WHERE is_active = true;
CREATE INDEX idx_quiz_questions_section ON public.quiz_questions(section_id, is_active)
  WHERE is_active = true;
CREATE INDEX idx_quiz_questions_type ON public.quiz_questions(question_type);
CREATE INDEX idx_quiz_questions_analytics ON public.quiz_questions(times_shown, times_correct)
  WHERE is_active = true AND times_shown >= 10;
CREATE INDEX idx_quiz_questions_flagged ON public.quiz_questions(auto_flagged)
  WHERE auto_flagged = true;
```

### Table: `quiz_attempts` (rebuilt)

```sql
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,

  attempt_number INTEGER NOT NULL,

  quiz_mode TEXT NOT NULL DEFAULT 'multiple_choice'
    CHECK (quiz_mode IN ('multiple_choice', 'voice', 'interactive_ai', 'mixed')),

  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'abandoned', 'awaiting_evaluation')),

  -- Results
  score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  passed BOOLEAN,
  competency_score SMALLINT DEFAULT 0
    CHECK (competency_score >= 0 AND competency_score <= 100),

  -- Questions covered (for pool draw tracking)
  questions_covered UUID[] DEFAULT '{}',

  -- Conversation mode tracking
  teaching_moments SMALLINT DEFAULT 0 CHECK (teaching_moments >= 0),
  additional_questions_asked SMALLINT DEFAULT 0 CHECK (additional_questions_asked >= 0),

  -- Transcript retention
  transcript_expires_at TIMESTAMPTZ,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, course_id, section_id, attempt_number)
);

CREATE INDEX idx_quiz_attempts_user ON public.quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_course ON public.quiz_attempts(course_id, status);
CREATE INDEX idx_quiz_attempts_enrollment ON public.quiz_attempts(enrollment_id);
CREATE INDEX idx_quiz_attempts_transcript_expires ON public.quiz_attempts(transcript_expires_at)
  WHERE transcript_expires_at IS NOT NULL;
```

### Table: `quiz_attempt_answers` (rebuilt)

```sql
CREATE TABLE public.quiz_attempt_answers (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,

  -- Multiple choice
  selected_option TEXT,
  is_correct BOOLEAN,

  -- Voice response
  transcription TEXT,
  voice_score INTEGER CHECK (voice_score IS NULL OR (voice_score >= 0 AND voice_score <= 100)),
  voice_feedback_en TEXT,
  voice_feedback_es TEXT,
  transcription_expires_at TIMESTAMPTZ,

  time_spent_seconds INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quiz_attempt_answers_attempt ON public.quiz_attempt_answers(attempt_id);
CREATE INDEX idx_quiz_attempt_answers_question ON public.quiz_attempt_answers(question_id);
```

### Table: `conversation_messages` (rebuilt, normalized child table)

```sql
CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_messages_attempt
  ON public.conversation_messages(attempt_id, created_at);
```

### Triggers & RLS

```sql
-- updated_at
CREATE TRIGGER trg_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_quiz_attempts_updated_at
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- ─── quiz_questions RLS ──────────────────────────────────────────────────────
CREATE POLICY "Users can view active questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (
    is_active = true
    AND group_id = public.get_user_group_id()
  );

CREATE POLICY "Managers can view all questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can insert questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (
    group_id = public.get_user_group_id()
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── quiz_attempts RLS ───────────────────────────────────────────────────────
CREATE POLICY "Users can view own attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group attempts"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = quiz_attempts.course_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own attempts"
  ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attempts"
  ON public.quiz_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── quiz_attempt_answers RLS ────────────────────────────────────────────────
CREATE POLICY "Users can view own answers"
  ON public.quiz_attempt_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = quiz_attempt_answers.attempt_id AND qa.user_id = auth.uid()
  ));

CREATE POLICY "Managers can view group answers"
  ON public.quiz_attempt_answers FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.courses c ON c.id = qa.course_id
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own answers"
  ON public.quiz_attempt_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = quiz_attempt_answers.attempt_id AND qa.user_id = auth.uid()
  ));

-- ─── conversation_messages RLS ───────────────────────────────────────────────
CREATE POLICY "Users can view own messages"
  ON public.conversation_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = conversation_messages.attempt_id AND qa.user_id = auth.uid()
  ));

CREATE POLICY "Managers can view group messages"
  ON public.conversation_messages FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      JOIN public.courses c ON c.id = qa.course_id
      WHERE qa.id = conversation_messages.attempt_id
        AND c.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can insert own messages"
  ON public.conversation_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.quiz_attempts qa
    WHERE qa.id = conversation_messages.attempt_id AND qa.user_id = auth.uid()
  ));
```

### Auto-Flag Low-Quality Questions Function

```sql
-- Auto-flag questions with >70% miss rate after 10+ attempts
CREATE OR REPLACE FUNCTION public.auto_flag_quiz_questions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only check when times_shown changes
  IF NEW.times_shown >= 10 THEN
    NEW.auto_flagged := (
      (NEW.times_shown - NEW.times_correct)::FLOAT / NEW.times_shown > 0.70
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_flag_quiz_questions
  BEFORE UPDATE OF times_shown, times_correct ON public.quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_flag_quiz_questions();
```

**Validation**: 4 tables, ~20 RLS policies, auto-flag trigger

---

## Phase DB-6: Rollouts, Evaluations & Change Detection

**Goal**: Create rollouts, evaluations, and the content change tracking system. These are the management and quality assurance tables.

**Migration**: `20260305100600_cb_phase6_rollouts_evaluations_changes.sql`

### Table: `evaluations` (rebuilt)

```sql
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.course_enrollments(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.course_sections(id) ON DELETE SET NULL,

  eval_type TEXT NOT NULL
    CHECK (eval_type IN ('session', 'quiz', 'course_final', 'interactive_ai')),

  -- Dual feedback
  student_feedback JSONB NOT NULL,
  manager_feedback JSONB NOT NULL,
  manager_notes TEXT,

  competency_level TEXT
    CHECK (competency_level IN ('novice', 'competent', 'proficient', 'expert')),

  evaluated_by UUID REFERENCES public.profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_evaluations_user ON public.evaluations(user_id, eval_type);
CREATE INDEX idx_evaluations_enrollment ON public.evaluations(enrollment_id);
CREATE INDEX idx_evaluations_course ON public.evaluations(course_id);
```

### Table: `rollouts` (rebuilt)

```sql
CREATE TABLE public.rollouts (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  course_ids UUID[] NOT NULL DEFAULT '{}',
  section_ids UUID[] NOT NULL DEFAULT '{}',

  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed', 'expired', 'archived')),

  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rollouts_group ON public.rollouts(group_id, status);
CREATE INDEX idx_rollouts_deadline ON public.rollouts(deadline) WHERE deadline IS NOT NULL;
```

### Table: `rollout_assignments` (rebuilt)

```sql
CREATE TABLE public.rollout_assignments (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  rollout_id UUID NOT NULL REFERENCES public.rollouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  total_courses INTEGER NOT NULL DEFAULT 0,
  completed_courses INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(rollout_id, user_id)
);

CREATE INDEX idx_rollout_assignments_rollout ON public.rollout_assignments(rollout_id, status);
CREATE INDEX idx_rollout_assignments_user ON public.rollout_assignments(user_id, status);
```

### Table: `content_change_log` (rebuilt for element-based architecture)

This is the source-level change tracker. When any source record (manual_sections, products) is updated, changes are logged here.

```sql
CREATE TABLE public.content_change_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,

  source_table TEXT NOT NULL CHECK (source_table IN (
    'manual_sections', 'foh_plate_specs', 'plate_specs',
    'prep_recipes', 'wines', 'cocktails', 'beer_liquor_list'
  )),
  source_id UUID NOT NULL,

  content_hash TEXT NOT NULL,
  previous_hash TEXT,

  -- Which courses and elements are affected
  affected_courses JSONB DEFAULT '[]',
  -- [{course_id, course_title, section_id, element_keys: []}]

  -- Acknowledgment
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(source_table, source_id, content_hash)
);

CREATE INDEX idx_content_change_log_source
  ON public.content_change_log(source_table, source_id, created_at DESC);
CREATE INDEX idx_content_change_log_unacknowledged
  ON public.content_change_log(acknowledged_by) WHERE acknowledged_by IS NULL;
CREATE INDEX idx_content_change_log_group
  ON public.content_change_log(group_id, created_at DESC);
```

### Table: `course_change_log` (NEW -- tracks automatic course rebuilds)

```sql
CREATE TABLE public.course_change_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,

  -- What triggered the rebuild
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('content_change', 'manual_rebuild', 'quiz_regen')),
  trigger_source JSONB NOT NULL,
  -- {source_table, source_id, old_hash, new_hash, source_title}

  -- What was rebuilt
  elements_rebuilt INTEGER NOT NULL DEFAULT 0,
  questions_regenerated INTEGER NOT NULL DEFAULT 0,
  rebuild_details JSONB DEFAULT '[]',
  -- [{section_id, element_key, element_type, action: 'regenerated'|'updated'}]

  -- Version tracking
  old_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,

  -- Review status
  review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_course_change_log_course
  ON public.course_change_log(course_id, created_at DESC);
CREATE INDEX idx_course_change_log_pending
  ON public.course_change_log(group_id, review_status)
  WHERE review_status = 'pending';
```

### Triggers & RLS

```sql
-- updated_at
CREATE TRIGGER trg_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rollouts_updated_at
  BEFORE UPDATE ON public.rollouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rollout_assignments_updated_at
  BEFORE UPDATE ON public.rollout_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rollout_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_change_log ENABLE ROW LEVEL SECURITY;

-- ─── evaluations RLS ─────────────────────────────────────────────────────────
CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group evaluations"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.group_memberships gm ON gm.user_id = p.id
      WHERE p.id = evaluations.user_id AND gm.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can insert evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Managers can update evaluations"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete evaluations"
  ON public.evaluations FOR DELETE TO authenticated
  USING (public.get_user_role() = 'admin');

-- ─── rollouts RLS ────────────────────────────────────────────────────────────
CREATE POLICY "Users can view rollouts"
  ON public.rollouts FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert rollouts"
  ON public.rollouts FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Managers can update rollouts"
  ON public.rollouts FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Admins can delete rollouts"
  ON public.rollouts FOR DELETE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() = 'admin');

-- ─── rollout_assignments RLS ─────────────────────────────────────────────────
CREATE POLICY "Users can view own assignments"
  ON public.rollout_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers can view group assignments"
  ON public.rollout_assignments FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Managers can insert assignments"
  ON public.rollout_assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Users can update own assignments"
  ON public.rollout_assignments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can update assignments"
  ON public.rollout_assignments FOR UPDATE TO authenticated
  USING (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  )
  WITH CHECK (
    public.get_user_role() IN ('manager', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

CREATE POLICY "Admins can delete assignments"
  ON public.rollout_assignments FOR DELETE TO authenticated
  USING (
    public.get_user_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM public.rollouts r
      WHERE r.id = rollout_assignments.rollout_id
        AND r.group_id = public.get_user_group_id()
    )
  );

-- ─── content_change_log RLS ──────────────────────────────────────────────────
CREATE POLICY "Users can view change logs"
  ON public.content_change_log FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert change logs"
  ON public.content_change_log FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Managers can update change logs"
  ON public.content_change_log FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

-- ─── course_change_log RLS ───────────────────────────────────────────────────
CREATE POLICY "Users can view course change logs"
  ON public.course_change_log FOR SELECT TO authenticated
  USING (group_id = public.get_user_group_id());

CREATE POLICY "Managers can insert course change logs"
  ON public.course_change_log FOR INSERT TO authenticated
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));

CREATE POLICY "Managers can update course change logs"
  ON public.course_change_log FOR UPDATE TO authenticated
  USING (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'))
  WITH CHECK (group_id = public.get_user_group_id() AND public.get_user_role() IN ('manager', 'admin'));
```

### Management Functions (rebuilt)

```sql
-- ─── expire_rollouts() ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.expire_rollouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rollouts SET status = 'expired'
  WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now();

  UPDATE public.rollout_assignments ra SET status = 'overdue'
  FROM public.rollouts r
  WHERE ra.rollout_id = r.id
    AND r.status IN ('active', 'expired')
    AND r.deadline IS NOT NULL AND r.deadline < now()
    AND ra.status IN ('assigned', 'in_progress');
END;
$$;

-- ─── cleanup_expired_training_data() ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_expired_training_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete expired conversations (non-flagged)
  DELETE FROM public.course_conversations
  WHERE expires_at < now() AND is_flagged = false;

  -- Redact expired voice transcriptions
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;

  -- Delete expired conversation messages
  DELETE FROM public.conversation_messages
  WHERE attempt_id IN (
    SELECT id FROM public.quiz_attempts
    WHERE transcript_expires_at IS NOT NULL AND transcript_expires_at < now()
  );

  -- Clear expiry marker
  UPDATE public.quiz_attempts
  SET transcript_expires_at = NULL
  WHERE transcript_expires_at IS NOT NULL AND transcript_expires_at < now();

  -- Expire rollouts
  PERFORM public.expire_rollouts();
END;
$$;

-- ─── Re-schedule cron job ────────────────────────────────────────────────────
SELECT cron.schedule(
  'cleanup-training-data',
  '0 2 * * *',
  'SELECT public.cleanup_expired_training_data()'
);

-- ─── detect_content_changes() (rebuilt for element-based source_refs) ────────
CREATE OR REPLACE FUNCTION public.detect_content_changes(p_group_id UUID)
RETURNS TABLE(
  course_id UUID,
  course_title TEXT,
  section_id UUID,
  element_key TEXT,
  source_table TEXT,
  source_id UUID,
  old_hash TEXT,
  new_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sec RECORD;
  elem RECORD;
  ref RECORD;
  computed_hash TEXT;
BEGIN
  -- Iterate over all published course sections in this group
  FOR sec IN
    SELECT cs.id AS section_id, cs.elements, cs.source_refs,
           c.id AS course_id, c.title_en AS course_title
    FROM public.course_sections cs
    JOIN public.courses c ON c.id = cs.course_id
    WHERE c.group_id = p_group_id
      AND c.status = 'published'
  LOOP
    -- Check each source_ref in the section
    FOR ref IN
      SELECT
        r->>'table' AS ref_table,
        (r->>'id')::UUID AS ref_id,
        r->>'content_hash' AS ref_hash
      FROM jsonb_array_elements(sec.source_refs) AS r
    LOOP
      computed_hash := NULL;

      -- Compute current hash per table (same pattern as old function)
      IF ref.ref_table = 'manual_sections' THEN
        SELECT md5(COALESCE(m.title_en,'') || COALESCE(m.content_en,'') || COALESCE(m.content_es,''))
          INTO computed_hash FROM public.manual_sections m WHERE m.id = ref.ref_id;
      ELSIF ref.ref_table = 'foh_plate_specs' THEN
        SELECT md5(COALESCE(f.menu_name,'') || COALESCE(f.short_description,'') || COALESCE(f.detailed_description,''))
          INTO computed_hash FROM public.foh_plate_specs f WHERE f.id = ref.ref_id;
      ELSIF ref.ref_table = 'wines' THEN
        SELECT md5(COALESCE(w.name,'') || COALESCE(w.tasting_notes,'') || COALESCE(w.producer_notes,''))
          INTO computed_hash FROM public.wines w WHERE w.id = ref.ref_id;
      ELSIF ref.ref_table = 'cocktails' THEN
        SELECT md5(COALESCE(ct.name,'') || COALESCE(ct.description,'') || COALESCE(ct.tasting_notes,''))
          INTO computed_hash FROM public.cocktails ct WHERE ct.id = ref.ref_id;
      ELSIF ref.ref_table = 'prep_recipes' THEN
        SELECT md5(COALESCE(pr.name,'') || COALESCE(pr.ingredients::text,'') || COALESCE(pr.procedure::text,''))
          INTO computed_hash FROM public.prep_recipes pr WHERE pr.id = ref.ref_id;
      ELSIF ref.ref_table = 'beer_liquor_list' THEN
        SELECT md5(COALESCE(bl.name,'') || COALESCE(bl.description,'') || COALESCE(bl.notes,''))
          INTO computed_hash FROM public.beer_liquor_list bl WHERE bl.id = ref.ref_id;
      ELSIF ref.ref_table = 'plate_specs' THEN
        SELECT md5(COALESCE(ps.name,'') || COALESCE(ps.components::text,'') || COALESCE(ps.assembly_procedure::text,''))
          INTO computed_hash FROM public.plate_specs ps WHERE ps.id = ref.ref_id;
      END IF;

      IF computed_hash IS NULL THEN CONTINUE; END IF;

      -- Compare with stored hash
      IF ref.ref_hash IS NOT NULL AND computed_hash != ref.ref_hash THEN
        course_id := sec.course_id;
        course_title := sec.course_title;
        section_id := sec.section_id;
        element_key := NULL; -- Could be enhanced to map to specific elements
        source_table := ref.ref_table;
        source_id := ref.ref_id;
        old_hash := ref.ref_hash;
        new_hash := computed_hash;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- ─── get_team_progress() (rebuilt) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_team_progress(p_group_id UUID)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  courses_completed INTEGER,
  courses_total INTEGER,
  overall_progress_percent NUMERIC,
  average_quiz_score NUMERIC,
  last_active_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    gm.role::TEXT,
    COALESCE(agg.completed, 0)::INTEGER AS courses_completed,
    COALESCE(agg.total, 0)::INTEGER AS courses_total,
    CASE WHEN COALESCE(agg.total, 0) > 0
      THEN ROUND((agg.completed::NUMERIC / agg.total) * 100, 1) ELSE 0
    END AS overall_progress_percent,
    agg.avg_score AS average_quiz_score,
    agg.last_active AS last_active_at
  FROM public.profiles p
  JOIN public.group_memberships gm ON gm.user_id = p.id AND gm.group_id = p_group_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed,
      COUNT(*) AS total,
      ROUND(AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL), 1) AS avg_score,
      MAX(ce.updated_at) AS last_active
    FROM public.course_enrollments ce
    WHERE ce.user_id = p.id AND ce.group_id = p_group_id
  ) agg ON true
  WHERE p.is_active = true
  ORDER BY overall_progress_percent ASC;
END;
$$;
```

**Validation**: 5 tables, ~25 RLS policies, 3 management functions, 1 cron job

---

## Phase DB-7: Storage Bucket & AI Prompts

**Goal**: Create the `course-media` storage bucket and seed Course Builder AI prompts.

**Migration**: `20260305100700_cb_phase7_storage_and_prompts.sql`

### Storage Bucket: `course-media`

```sql
-- Create course-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-media',
  'course-media',
  false,  -- Private bucket
  52428800,  -- 50MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can view course media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-media');

CREATE POLICY "Managers can upload course media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-media'
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Managers can update course media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-media'
    AND public.get_user_role() IN ('manager', 'admin')
  );

CREATE POLICY "Admins can delete course media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-media'
    AND public.get_user_role() = 'admin'
  );
```

### AI Prompts Seed Data

```sql
-- Course Builder AI prompts
INSERT INTO public.ai_prompts (slug, category, domain, prompt_en, prompt_es, is_active)
VALUES
  (
    'course-outline-generator', 'system', NULL,
    E'You are an expert restaurant training course designer for Alamo Prime steakhouse. Given the course type, selected source material, and admin instructions, generate a structured course outline.\n\nOUTPUT FORMAT: Return a JSON array of course sections, each containing:\n- title_en, title_es\n- description_en, description_es\n- section_type: overview | lesson | quiz | summary\n- elements: array of CourseElement outlines (type, key, title, ai_instructions, sort_order, status: \"outline\")\n\nRULES:\n1. Every course starts with an \"overview\" section and ends with a \"summary\" section.\n2. Break content into digestible 5-10 minute lessons.\n3. Include feature (callout) elements for: allergen warnings, best practices, tips, key points.\n4. Include media elements where product images exist.\n5. The ai_instructions on each element should be specific enough that another AI can generate the full content from them.\n6. For bilingual content, generate both EN and ES titles.\n7. Be thorough but concise — staff are learning on mobile devices.',
    NULL,
    true
  ),
  (
    'course-element-builder', 'system', NULL,
    E'You are generating content for a single course element in a restaurant training course at Alamo Prime steakhouse.\n\nYou will receive:\n- The element type (content, feature, media)\n- The ai_instructions for this specific element\n- The source material (complete, untruncated)\n- The course context (title, type, teacher level)\n\nRULES:\n1. Use ONLY facts from the source material. Never invent menu items, prices, temperatures, or procedures.\n2. Format as rich Markdown: headers, tables, lists, bold/italic where appropriate.\n3. For bilingual output, generate both body_en and body_es.\n4. For feature elements, match the variant (tip, caution, warning, etc.) to the content.\n5. For media elements, suggest appropriate images and provide descriptive alt_text.\n6. Keep content mobile-friendly: short paragraphs, clear headers, scannable.\n7. Match the teacher_level tone: friendly, professional, strict, or expert.',
    NULL,
    true
  ),
  (
    'quiz-pool-generator', 'system', NULL,
    E'You are generating quiz questions for a restaurant training course at Alamo Prime steakhouse.\n\nYou will receive:\n- The course content (all elements from all sections)\n- The original source material\n- The quiz configuration (mode, pool_size, difficulty distribution)\n\nRULES:\n1. Generate questions ONLY from the provided content and source material.\n2. For multiple_choice: 4 options, 1 correct. Distractors should be plausible but clearly wrong.\n3. For voice: open-ended questions that test verbal articulation (\"Describe...\", \"Explain to a guest...\").\n4. For interactive_ai: role-play scenarios with clear evaluation criteria.\n5. Distribute difficulty: ~30% easy, ~50% medium, ~20% hard.\n6. Each question must reference a specific element or source section.\n7. Bilingual: provide question_en and question_es for all questions.\n8. For MC options, provide text_en and text_es.\n9. Avoid trick questions. Test practical knowledge, not trivia.',
    NULL,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  prompt_en = EXCLUDED.prompt_en,
  prompt_es = EXCLUDED.prompt_es,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active;
```

**Validation**: 1 storage bucket, 3 AI prompts seeded

---

## Migration File Summary

| # | Filename | Phase | Contents |
|---|----------|-------|----------|
| 1 | `20260305100000_cb_phase1_teardown.sql` | DB-1 | Drop 18 tables, 5 functions, 1 cron job, cleanup prompts |
| 2 | `20260305100100_cb_phase2_create_section_chunks.sql` | DB-2 | `section_chunks` table, FTS trigger, RLS, indexes |
| 3 | `20260305100200_cb_phase2_chunk_search_function.sql` | DB-2 | `search_chunks()`, `get_full_sections()` functions |
| 4 | `20260305100300_cb_phase3_core_course_tables.sql` | DB-3 | `training_programs`, `courses`, `course_sections` + RLS |
| 5 | `20260305100400_cb_phase4_enrollment_progress.sql` | DB-4 | `course_enrollments`, `section_progress`, `program_enrollments`, `course_conversations` + RLS + auto-sync trigger |
| 6 | `20260305100500_cb_phase5_quiz_assessment.sql` | DB-5 | `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `conversation_messages` + RLS + auto-flag trigger |
| 7 | `20260305100600_cb_phase6_rollouts_evaluations_changes.sql` | DB-6 | `evaluations`, `rollouts`, `rollout_assignments`, `content_change_log`, `course_change_log` + RLS + management functions + cron |
| 8 | `20260305100700_cb_phase7_storage_and_prompts.sql` | DB-7 | `course-media` bucket, 3 AI prompt seeds |

**Total**: 8 migrations, 16 new tables, 1 storage bucket, ~85 RLS policies, 8+ functions, 2 triggers (auto-flag + auto-sync), 1 cron job

---

## Dependency Graph

```
DB-1 Teardown (MUST be first -- cleans namespace)
  |
  ├── DB-2 Section Chunks (no dependency on courses, only manual_sections)
  |
  └── DB-3 Core Course Tables (training_programs, courses, course_sections)
        |
        ├── DB-4 Enrollment & Progress (depends on courses, course_sections)
        |     |
        |     └── DB-5 Quiz & Assessment (depends on courses, course_sections, course_enrollments)
        |
        └── DB-6 Rollouts, Evaluations & Change Detection (depends on courses, course_sections, course_enrollments)
              |
              └── DB-7 Storage Bucket & AI Prompts (independent, but logically last)
```

DB-2 (chunks) and DB-3 (core tables) can run in parallel after teardown. DB-4 depends on DB-3. DB-5 depends on DB-4. DB-6 depends on DB-4. DB-7 is independent.

For `npx supabase db push`, they will run sequentially in timestamp order which respects all dependencies.

---

## Verification Queries

Run these after all migrations to validate the schema:

```sql
-- 1. Count all new tables (should be 16)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'section_chunks', 'training_programs', 'courses', 'course_sections',
    'course_enrollments', 'section_progress', 'program_enrollments',
    'course_conversations', 'quiz_questions', 'quiz_attempts',
    'quiz_attempt_answers', 'conversation_messages', 'evaluations',
    'rollouts', 'rollout_assignments', 'content_change_log',
    'course_change_log'
  );
-- Expected: 17

-- 2. Verify NO old tables remain
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('module_test_attempts', 'module_test_answers', 'tutor_sessions');
-- Expected: 0 rows

-- 3. Count RLS policies
SELECT count(*) FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'section_chunks', 'training_programs', 'courses', 'course_sections',
    'course_enrollments', 'section_progress', 'program_enrollments',
    'course_conversations', 'quiz_questions', 'quiz_attempts',
    'quiz_attempt_answers', 'conversation_messages', 'evaluations',
    'rollouts', 'rollout_assignments', 'content_change_log',
    'course_change_log'
  );
-- Expected: ~85

-- 4. Verify preserved tables
SELECT count(*) FROM public.ai_teachers;
-- Expected: > 0

SELECT count(*) FROM public.ai_prompts WHERE slug LIKE 'course-%' OR slug LIKE 'quiz-pool%';
-- Expected: 3

-- 5. Verify course_sections.elements is JSONB array
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.course_sections'::regclass
  AND conname = 'course_sections_elements_is_array';
-- Expected: 1 row

-- 6. Verify storage bucket
SELECT id FROM storage.buckets WHERE id = 'course-media';
-- Expected: 1 row

-- 7. Verify HNSW indexes on section_chunks
SELECT indexname FROM pg_indexes
WHERE tablename = 'section_chunks' AND indexdef LIKE '%hnsw%';
-- Expected: 2 rows (en + es)

-- 8. Verify GIN indexes on section_chunks
SELECT indexname FROM pg_indexes
WHERE tablename = 'section_chunks' AND indexdef LIKE '%gin%';
-- Expected: 2 rows (en + es)

-- 9. Verify cron job rescheduled
SELECT jobname FROM cron.job WHERE jobname = 'cleanup-training-data';
-- Expected: 1 row

-- 10. Verify functions exist
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'search_chunks', 'get_full_sections', 'detect_content_changes',
    'get_team_progress', 'expire_rollouts', 'cleanup_expired_training_data',
    'sync_program_enrollment_on_course_complete', 'auto_flag_quiz_questions',
    'update_section_chunk_search_vectors'
  );
-- Expected: 9 rows
```

---

## What Comes AFTER These Migrations

These database phases create the complete schema. The following work is **not database migrations** but depends on the schema being in place:

1. **Chunk Existing Manual Content** (edge function or script): Read all 30 `manual_sections`, split into chunks, insert into `section_chunks`, generate embeddings via `text-embedding-3-small`. This produces ~100-200 chunks.

2. **Update `ask` Edge Function**: Switch from `search_manual_v2` to `search_chunks` for AI Q&A queries.

3. **Build Course Edge Functions**: `build-course`, `build-course-element`, `generate-course-image`, `generate-quiz-pool` -- all operate on the new schema.

4. **Frontend**: Course Builder UI, Course Player UI, Manager Dashboard -- all new components working against the new tables.

---

## Notes on Backward Compatibility

- `search_manual_v2` is **kept** (not dropped) -- it still works for backward-compatible full-section search. The new `search_chunks` function supplements it for Q&A.
- `ai_teachers` table is **untouched** -- courses reference it via `courses.teacher_id`.
- `ai_prompts` table is **preserved** with training-specific prompts cleaned up and Course Builder prompts added.
- `manual_sections` table is **untouched** -- `section_chunks` is additive, not replacing it.
- The `get_user_group_id()`, `get_user_role()`, and `set_updated_at()` helper functions are **preserved** (not dropped in teardown) -- they serve the entire application.
