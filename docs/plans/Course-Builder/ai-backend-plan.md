# Course Builder — AI & Backend Phased Plan

> Comprehensive plan for all AI pipelines, edge functions, prompts, search updates, chunking, image generation, quiz generation, credit tracking, voice integration, and element-level rebuild infrastructure.

---

## ⚠️ Master Plan Alignment (Updated 2026-03-05)

> This sub-plan was written BEFORE the owner's design decisions were finalized. The **master-implementation-plan.md** is the authoritative document. The following alignment notes indicate where this sub-plan diverges and what takes precedence at build time.

### Phase Mapping (Backend phases → Master Plan phases)

| Backend Phase | Maps to Master Plan | Key Difference |
|---------------|-------------------|----------------|
| B1: Chunking Pipeline | **Phase 7** (NOT Phase 2) | Master plan DEFERS chunks to Phase 7. `get_full_sections()` is Phase 2. Chunking + `search_chunks()` + `embed-sections` chunk mode → Phase 7. |
| B2: Course Generation | **Phase 4** | Same content. |
| B3: Element-Level AI Regen | **Phase 4** | Same content. `build-course-element` ships with Phase 4. |
| B4: Quiz Generation | **Phase 5** | Same content. |
| B5: Image Generation | **Phase 4** (NOT deferred) | Master plan includes image gen in Phase 4. `generate-image` is a NEW function, not a modification. |
| B6: Mandatory Rebuild | **Phase 6** (REWRITTEN) | **CRITICAL**: Renamed to `rebuild-course-elements`. Element-level, NOT full-course. Admin-triggered, NOT automatic. See details below. |
| B7: Credit & Usage | **Phase 2** | Credit costs seeded in Phase 2 foundation. |
| B8: Voice Integration | **Phase 9** | Interactive AI quiz is Phase 9. |

### Key Design Changes (Owner Decisions)

1. **`rebuild-course` → `rebuild-course-elements`** — Function name changed. Rebuild is ELEMENT-LEVEL: takes a list of stale element keys, rebuilds only those elements + regenerates quiz questions for affected sections. Does NOT rebuild entire courses.

2. **Rebuilds are admin-triggered, NOT automatic** — No auto-rebuild pipeline. Triggers log changes to `content_change_log` with `affected_elements` JSONB. Admin clicks "Rebuild Affected Elements". Auto-rebuild toggle deferred to Phase 9 as optional feature.

3. **`search_manual_v2` is NOT modified** — Create a NEW `search_manual_chunks()` (or `search_chunks()`) function instead. Keep `search_manual_v2` as fallback. The `ask` edge function can switch to the new function later.

4. **`content_single` step removed from `build-course`** — Single element regeneration uses the separate `build-course-element` function. The `build-course` function has only two steps: `outline` and `content`.

5. **`generate-image` is a NEW function** — No existing `generate-image` function to modify. Build from scratch with `mode: 'course'` for educational illustrations.

6. **Image generation in Phase 4** — Ships alongside the AI pipeline, not deferred.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase B1: Chunking Pipeline & Search Updates](#2-phase-b1-chunking-pipeline--search-updates)
3. [Phase B2: Course Generation Pipeline](#3-phase-b2-course-generation-pipeline)
4. [Phase B3: Element-Level AI Regeneration](#4-phase-b3-element-level-ai-regeneration)
5. [Phase B4: Quiz Generation Pipeline](#5-phase-b4-quiz-generation-pipeline)
6. [Phase B5: Image Generation Pipeline](#6-phase-b5-image-generation-pipeline)
7. [Phase B6: Mandatory Rebuild Pipeline](#7-phase-b6-mandatory-rebuild-pipeline)
8. [Phase B7: Credit & Usage Tracking](#8-phase-b7-credit--usage-tracking)
9. [Phase B8: Voice Integration (Interactive AI Quiz)](#9-phase-b8-voice-integration-interactive-ai-quiz)
10. [Token Budget Analysis](#10-token-budget-analysis)
11. [Error Handling & Idempotency](#11-error-handling--idempotency)
12. [Edge Function Summary Table](#12-edge-function-summary-table)
13. [Data Flow Diagrams](#13-data-flow-diagrams)
14. [Prompt Templates](#14-prompt-templates)

---

## 1. Architecture Overview

### Edge Function Inventory

The Course Builder introduces **4 new edge functions** and **modifies 2 existing ones**:

| Function | Status | Purpose |
|----------|--------|---------|
| `build-course` | **NEW** | Two-step course generation (outline + content) |
| `build-course-element` | **NEW** | Single-element regeneration with instructions |
| `generate-quiz-pool` | **NEW** | Pre-generate question pool from course content |
| `rebuild-course-elements` | **NEW** | Element-level rebuild triggered by admin when source content changes |
| `generate-image` | **NEW** | Educational illustration generation via DALL-E 3, `course-media` bucket storage |
| `embed-sections` | **MODIFY** | Add chunk embedding mode (embed `section_chunks` not just `manual_sections`) |

### Existing Functions That Stay As-Is

These existing edge functions continue working unchanged. The Course Builder does NOT touch them:

- `ask` — Unified AI Q&A (will benefit from chunk-based search once `search_chunks()` is available in Phase 7)
- `ask-product` — Product AI (unchanged)
- `course-tutor` — Practice tutor for course sections (reused by Course Player)
- `course-quiz-generate` — Section-level quiz generation (reused, but `generate-quiz-pool` is the new builder-oriented version)
- `course-evaluate` — Quiz grading + evaluation (reused by Course Player)
- `course-assess` — Conversational assessment (reused by Course Player)
- `realtime-session` — WebRTC voice sessions (extended in Phase B8)
- `transcribe` — Whisper transcription (reused)

### Shared Utilities Strategy

New shared modules will be added to `supabase/functions/_shared/`:

| Module | Purpose |
|--------|---------|
| `_shared/course-builder.ts` | Source material assembly, element serialization, hash computation |
| `_shared/chunking.ts` | Markdown chunking algorithm (heading-based splitting) |

Existing shared modules are reused as-is:
- `_shared/cors.ts`, `_shared/auth.ts`, `_shared/supabase.ts`, `_shared/usage.ts`
- `_shared/openai.ts` (structured JSON output wrapper)
- `_shared/credit-pipeline.ts` (trackAndIncrement with audit logging)
- `_shared/content.ts` (serializers + content loader)
- `_shared/prompt-helpers.ts` (4-layer prompt assembly)

### AI Models Used

| Model | Purpose | Context Window |
|-------|---------|---------------|
| `gpt-4o-mini` | All text generation (outlines, content, quizzes, evaluations) | 128K tokens |
| `text-embedding-3-small` | Chunk embeddings (1536 dimensions) | 8K tokens |
| `dall-e-3` | Educational image generation | N/A |
| `gpt-realtime-2025-08-28` | Interactive AI quiz via WebRTC | Realtime |
| `whisper-1` | Voice transcription for quiz responses | N/A |

---

## 2. Phase B1: Chunking Pipeline & Search Updates

**Goal**: Create the dual-layer content architecture (full sections for course building, chunks for search).

### 2.1 New Table: `section_chunks`

```sql
CREATE TABLE section_chunks (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES manual_sections(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id),
  chunk_index INTEGER NOT NULL,
  heading TEXT,                     -- H2/H3 heading this chunk falls under
  content_en TEXT NOT NULL,         -- 300-800 words
  content_es TEXT,
  word_count_en INTEGER GENERATED ALWAYS AS (
    array_length(regexp_split_to_array(trim(content_en), '\s+'), 1)
  ) STORED,
  search_vector_en TSVECTOR,
  search_vector_es TSVECTOR,
  embedding_en VECTOR(1536),
  embedding_es VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (section_id, chunk_index)
);

-- FTS auto-population trigger
CREATE TRIGGER section_chunks_fts_trigger
  BEFORE INSERT OR UPDATE OF content_en, content_es, heading
  ON section_chunks
  FOR EACH ROW EXECUTE FUNCTION section_chunks_update_search_vectors();

-- Indexes
CREATE INDEX idx_section_chunks_section_id ON section_chunks(section_id);
CREATE INDEX idx_section_chunks_fts_en ON section_chunks USING GIN(search_vector_en);
CREATE INDEX idx_section_chunks_fts_es ON section_chunks USING GIN(search_vector_es);
CREATE INDEX idx_section_chunks_embedding_en ON section_chunks USING hnsw(embedding_en vector_cosine_ops);
CREATE INDEX idx_section_chunks_embedding_es ON section_chunks USING hnsw(embedding_es vector_cosine_ops);
```

### 2.2 Chunking Algorithm (`_shared/chunking.ts`)

```typescript
interface Chunk {
  chunk_index: number;
  heading: string | null;
  content: string;
}

/**
 * Split markdown content into chunks of 300-800 words.
 * Strategy:
 *   1. Split at H2 (##) boundaries first
 *   2. If a H2 section is > 800 words, split at H3 (###) boundaries
 *   3. If still > 800 words, split at paragraph boundaries
 *   4. Ensure minimum 300 words per chunk (merge small trailing chunks)
 */
export function chunkMarkdown(markdown: string): Chunk[] { ... }
```

**Key rules**:
- Split at `## ` and `### ` headings (natural section boundaries)
- Target: 300-800 words per chunk
- Each chunk retains its `heading` context (the most recent H2 or H3 above it)
- If a heading section is < 300 words, merge with the next chunk
- If > 800 words and no sub-headings, split at double-newlines (paragraph breaks)
- Numbered lists stay together if possible (don't split mid-list)

### 2.3 Chunking Edge Function Integration

Chunking is NOT a separate edge function. It runs in two places:

**A. Initial migration**: A one-time SQL migration calls a PG function `fn_chunk_all_sections()` that iterates all 30 populated sections, splits them, and inserts chunks. Embeddings are generated afterward by calling `embed-sections` with a new `mode: 'chunks'` parameter.

**B. Auto-chunking trigger**: When `manual_sections.content_en` or `content_es` is updated:

```sql
CREATE OR REPLACE FUNCTION fn_rechunk_section()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete existing chunks for this section
  DELETE FROM section_chunks WHERE section_id = NEW.id;

  -- Re-chunk (calls the PL/pgSQL chunking function)
  PERFORM fn_chunk_section(NEW.id, NEW.group_id, NEW.content_en, NEW.content_es);

  -- Mark chunks as needing re-embedding (set embedding_en = NULL)
  -- The embed-sections function will pick these up on next run

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

CREATE TRIGGER trg_rechunk_on_content_update
  AFTER UPDATE OF content_en, content_es ON manual_sections
  FOR EACH ROW
  WHEN (OLD.content_en IS DISTINCT FROM NEW.content_en
     OR OLD.content_es IS DISTINCT FROM NEW.content_es)
  EXECUTE FUNCTION fn_rechunk_section();
```

### 2.4 Modified `embed-sections` Edge Function

Add a `mode` parameter:

```typescript
interface EmbedRequest {
  sectionId?: string;
  mode?: 'sections' | 'chunks';  // NEW: default 'sections' for backward compat
}
```

When `mode = 'chunks'`:
- Query `section_chunks` where `embedding_en IS NULL`
- For each chunk: build embedding text as `Heading: {heading}\nContent: {content_en}`
- Generate embedding via `text-embedding-3-small`
- Update `section_chunks.embedding_en` (and `embedding_es` if content_es exists)
- Same 100ms delay, same batch processing pattern

### 2.5 Updated `search_manual_v2` PG Function

The existing `search_manual_v2` function searches `manual_sections` directly. It needs to be updated to search `section_chunks` instead, while still returning section-level metadata:

```sql
CREATE OR REPLACE FUNCTION search_manual_v2(
  search_query TEXT,
  query_embedding VECTOR(1536),
  search_language TEXT DEFAULT 'en',
  result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,              -- chunk ID (for deduplication)
  section_id UUID,      -- parent section ID (for navigation)
  slug TEXT,            -- section slug
  name TEXT,            -- section title
  snippet TEXT,         -- chunk content with <mark> highlights
  category TEXT,
  tags TEXT[],
  heading TEXT,         -- chunk heading context
  combined_score REAL
) AS $$
  -- Hybrid search on section_chunks (FTS + vector)
  -- Uses RRF to combine scores
  -- Returns chunk-level results with section metadata via JOIN
$$;
```

### 2.6 New Assembly Function for Course Building

```sql
CREATE OR REPLACE FUNCTION get_full_sections(
  section_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  title_en TEXT,
  title_es TEXT,
  content_en TEXT,
  content_es TEXT,
  category TEXT,
  tags TEXT[],
  word_count_en INTEGER
) AS $$
  SELECT id, slug, title_en, title_es, content_en, content_es,
         category, tags,
         array_length(regexp_split_to_array(trim(content_en), '\s+'), 1) as word_count_en
  FROM manual_sections
  WHERE id = ANY(section_ids)
    AND content_en IS NOT NULL
  ORDER BY sort_order;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

**Summary of what changes vs. stays**:
- `search_manual_v2` is KEPT AS-IS (NOT modified — remains as fallback for full-section search)
- `search_chunks()` is NEW (chunk-level hybrid search for AI Q&A — supplements, does not replace `search_manual_v2`)
- `get_full_sections` is NEW (for course building — returns complete content)
- The `manual_sections` table itself is UNCHANGED (still the source of truth)
- The old `embedding_en`/`embedding_es` columns on `manual_sections` are kept (chunks supplement, don't replace them)

---

## 3. Phase B2: Course Generation Pipeline

**Goal**: Build the `build-course` edge function that powers the two-step outline-then-content workflow.

### 3.1 Edge Function: `build-course`

**Endpoint**: `POST /functions/v1/build-course`
**Auth**: `--no-verify-jwt`, internal auth via `authenticateWithUser(req)` (write operation)
**Deploy**: `npx supabase functions deploy build-course --no-verify-jwt`

#### Request Contract

```typescript
interface BuildCourseRequest {
  // Required
  groupId: string;
  language: 'en' | 'es';

  // Step selection
  step: 'outline' | 'content' | 'content_single';

  // For 'outline' step — wizard inputs
  wizard_type?: 'menu_rollout' | 'sop_review' | 'steps_of_service' |
                'line_cook' | 'custom' | 'blank';
  course_title: string;
  course_description?: string;
  teacher_level?: 'friendly' | 'professional' | 'strict' | 'expert';
  ai_instructions?: string;        // Additional user instructions

  // Source material references
  source_sections?: string[];       // manual_sections IDs
  source_products?: Array<{         // product table + IDs
    table: string;                  // 'foh_plate_specs' | 'wines' | 'cocktails' | etc.
    ids: string[];
  }>;

  // For 'content' step — existing course with outline
  course_id?: string;

  // For 'content_single' — regenerate one element
  course_id?: string;
  section_id?: string;
  element_key?: string;
  element_instructions?: string;    // Override instructions for this element
}
```

#### Response Contract

```typescript
// For step='outline'
interface OutlineResponse {
  course_id: string;
  sections: Array<{
    section_id: string;
    title_en: string;
    title_es: string;
    sort_order: number;
    elements: CourseElement[];       // All with status: 'outline'
  }>;
  source_material_summary: string;  // What the AI found/used
  estimated_build_time_seconds: number;
}

// For step='content'
interface ContentResponse {
  course_id: string;
  sections_built: number;
  elements_built: number;
  errors: string[];                 // Any elements that failed
}

// For step='content_single'
interface SingleElementResponse {
  element: CourseElement;           // The regenerated element with status: 'generated'
}
```

### 3.2 Source Material Assembly Pipeline

This is the critical step — how the AI gets its source material. The assembly strategy differs by wizard type:

```
┌─────────────────────────────────────────────────────────────────┐
│                  SOURCE MATERIAL ASSEMBLY                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Wizard provides:                                               │
│    source_sections: [uuid, uuid, ...]                          │
│    source_products: [{table, ids}, ...]                        │
│                                                                 │
│  Step 1: Fetch FULL sections from manual_sections               │
│    → SELECT content_en, content_es FROM manual_sections         │
│      WHERE id = ANY(source_sections)                           │
│    → Returns complete, untruncated markdown                     │
│                                                                 │
│  Step 2: Fetch FULL products from product tables                │
│    → For each {table, ids}: SELECT * FROM {table}              │
│      WHERE id = ANY(ids)                                       │
│    → Serialize using CONTENT_SERIALIZERS from _shared/content   │
│                                                                 │
│  Step 3: Compute content hashes (for change tracking)           │
│    → MD5(content_en) for each section                          │
│    → MD5(JSON.stringify(record)) for each product              │
│    → Store as source_refs on each element                      │
│                                                                 │
│  Step 4: Estimate token count                                   │
│    → ~0.75 tokens per word (English)                           │
│    → If total > 60K tokens, warn but proceed                   │
│    → If total > 100K tokens, truncate least-relevant sections  │
│                                                                 │
│  Step 5: Pass assembled material to AI                          │
│    → System prompt: builder persona + wizard-specific rules     │
│    → User prompt: "Build a course outline for X using this..."  │
│    → Source material injected as context block                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Step 1: Outline Generation

**What happens**: The AI reads all source material and produces a structured course outline with element placeholders.

**AI Call**:
- Model: `gpt-4o-mini`
- `response_format`: Structured JSON (`json_schema`, `strict: true`)
- Temperature: 0.6 (creative but controlled)
- Max tokens: 4000
- System prompt: See [Prompt Templates > Course Outline Generator](#141-course-outline-generator)

**Structured Output Schema**:

```typescript
const outlineSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title_en: { type: "string" },
          title_es: { type: "string" },
          elements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["content", "feature", "media"] },
                key: { type: "string" },
                title_en: { type: "string" },
                title_es: { type: "string" },
                ai_instructions: { type: "string" },
                // Feature-specific
                variant: { type: "string", enum: [
                  "tip", "best_practice", "caution", "warning",
                  "did_you_know", "key_point"
                ] },
                // Media-specific
                media_type: { type: "string", enum: ["image", "video", "youtube"] },
                image_source: { type: "string", enum: [
                  "upload", "ai_generated", "product_image", "external"
                ] },
                product_image_ref: { type: "string" },  // product ID if using existing image
                sort_order: { type: "number" },
                source_refs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      table: { type: "string" },
                      id: { type: "string" },
                      content_hash: { type: "string" },
                    },
                    required: ["table", "id", "content_hash"],
                    additionalProperties: false,
                  }
                },
              },
              required: ["type", "key", "title_en", "title_es",
                         "ai_instructions", "sort_order", "source_refs"],
              additionalProperties: false,
            }
          }
        },
        required: ["title_en", "title_es", "elements"],
        additionalProperties: false,
      }
    }
  },
  required: ["sections"],
  additionalProperties: false,
};
```

**After outline generation**:
1. Create the `courses` row (status: 'draft')
2. Create `course_sections` rows (one per outline section)
3. Store elements JSONB on each section (all with `status: 'outline'`)
4. Return the outline to the UI for review

### 3.4 Step 2: Content Generation

**What happens**: For each section, for each element with `status: 'outline'`, the AI generates full content.

**Processing strategy**: Sequential per section, parallel elements within a section would be ideal but we process sequentially to stay within rate limits and keep context coherent.

```
For each section:
  1. Fetch the section's elements JSONB
  2. For each element where status === 'outline':
     a. Build element-specific prompt from ai_instructions
     b. Include relevant source material (from source_refs)
     c. Call gpt-4o-mini with element-specific schema
     d. Update the element in the JSONB array (status: 'generated')
  3. Save the updated elements JSONB to course_sections
  4. Report progress (section X of Y complete)
```

**Per-element AI call**:
- Model: `gpt-4o-mini`
- Temperature: 0.5
- Max tokens: 2000 (content), 800 (feature), 300 (media caption)

**Content element output schema**:
```typescript
{
  body_en: string,      // Full markdown
  body_es: string,      // Spanish translation
}
```

**Feature element output schema**:
```typescript
{
  body_en: string,      // Callout text (markdown)
  body_es: string,
  variant: string,      // May be adjusted by AI
}
```

**Media element output**: No AI call needed for `product_image` source (just look up the product's image URL). For `ai_generated`, we mark it for Phase B5 (image generation).

### 3.5 Database Operations

During outline generation:
```sql
-- 1. Insert course
INSERT INTO courses (group_id, title_en, title_es, description_en, description_es,
  course_type, teacher_level, status, version, created_by)
VALUES (...) RETURNING id;

-- 2. Insert sections with elements JSONB
INSERT INTO course_sections (course_id, title_en, title_es, elements, sort_order,
  generation_status)
VALUES (...);
```

During content generation:
```sql
-- Update elements JSONB on each section as content is generated
UPDATE course_sections
SET elements = $1,  -- Updated JSONB with generated content
    generation_status = 'generated',
    updated_at = now()
WHERE id = $2;
```

---

## 4. Phase B3: Element-Level AI Regeneration

**Goal**: Build `build-course-element` for regenerating a single element with new instructions.

### 4.1 Edge Function: `build-course-element`

**Endpoint**: `POST /functions/v1/build-course-element`
**Auth**: `authenticateWithUser(req)`

#### Request

```typescript
interface BuildElementRequest {
  groupId: string;
  language: 'en' | 'es';
  course_id: string;
  section_id: string;
  element_key: string;
  instructions: string;        // New or modified instructions
  // Optional: override source material
  source_refs?: SourceRef[];
}
```

#### Response

```typescript
interface BuildElementResponse {
  element: CourseElement;      // Updated element with status: 'generated'
}
```

### 4.2 Processing Flow

```
1. Authenticate user (must be admin/manager + own the course)
2. Fetch the course_section row
3. Find the element by key in the elements JSONB
4. Fetch source material from source_refs (full sections + products)
5. Build system prompt (element type-specific)
6. Call gpt-4o-mini with the instructions + source material
7. Parse structured output
8. Update the element in the JSONB array
9. Save back to course_sections
10. Return the updated element
```

### 4.3 AI Chat Panel Integration

The AI chat panel in the builder (right side) uses a different pattern. It sends free-text instructions that may affect MULTIPLE elements. This is handled by a special mode in `build-course`:

```typescript
// Chat panel request
{
  step: 'chat_edit',
  course_id: string,
  section_id: string,
  instruction: string,          // "Add a warning about shellfish after every dish section"
  language: 'en' | 'es',
  groupId: string,
}
```

The AI receives the entire section's elements array + the instruction, and returns a modified elements array. The diff is computed client-side to show what changed.

**AI response schema for chat_edit**:

```typescript
{
  modified_elements: Array<{
    key: string,               // Existing or new element key
    action: 'update' | 'insert' | 'delete',
    element?: CourseElement,    // Updated/new element (null for delete)
    insert_after?: string,     // Key of element to insert after
  }>
}
```

---

## 5. Phase B4: Quiz Generation Pipeline

**Goal**: Build `generate-quiz-pool` for pre-generating question pools at course build time.

### 5.1 Edge Function: `generate-quiz-pool`

This is DIFFERENT from the existing `course-quiz-generate` (which generates questions per-section for the Player). `generate-quiz-pool` generates a large question pool for the entire course at build time.

**Endpoint**: `POST /functions/v1/generate-quiz-pool`
**Auth**: `authenticateWithUser(req)`

#### Request

```typescript
interface GenerateQuizPoolRequest {
  groupId: string;
  language: 'en' | 'es';
  course_id: string;
  pool_size: number;            // Total questions to generate (e.g., 30)
  quiz_mode: 'multiple_choice' | 'voice_response' | 'interactive_ai' | 'mixed';
  // For mixed mode
  mc_count?: number;            // How many MC questions
  voice_count?: number;         // How many voice questions
  interactive_scenarios?: number; // How many IA scenarios
  force_regenerate?: boolean;   // Archive existing + regenerate
}
```

#### Response

```typescript
interface GenerateQuizPoolResponse {
  pool_size: number;
  questions_generated: number;
  mc_count: number;
  voice_count: number;
  interactive_count: number;
  errors: string[];
}
```

### 5.2 Generation Strategy

Quiz generation is token-intensive. For 30 questions across a 5-section course:

```
1. Fetch ALL course_sections with their elements JSONB
2. For each section, extract the generated content (body_en from content + feature elements)
3. Concatenate into a single course content document
4. Also fetch the ORIGINAL source material (from source_refs on each element)
5. Build the AI prompt with BOTH:
   - The course content (what the student will learn)
   - The source material (ground truth for answer verification)
6. Call gpt-4o-mini to generate questions in batches:
   - Batch 1: 15 MC questions (to stay under token limits)
   - Batch 2: 15 MC questions (if pool_size > 15)
   OR
   - Single call for <= 15 questions
7. For voice questions: separate call with voice-specific rubric schema
8. For interactive scenarios: separate call with scenario schema
```

**Batching rationale**: At ~3000 output tokens per 15 MC questions, we stay well within the 16K output token limit for gpt-4o-mini. Generating 30 in one call risks truncation.

### 5.3 Question Schema (Structured Output)

Uses the same schema as existing `course-quiz-generate` (proven pattern):

```typescript
const quizPoolSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_type: { type: "string", enum: ["multiple_choice", "voice"] },
          question_en: { type: "string" },
          question_es: { type: "string" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          section_index: { type: "number" },    // Which course section this tests
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text_en: { type: "string" },
                text_es: { type: "string" },
                correct: { type: "boolean" },
              },
              required: ["id", "text_en", "text_es", "correct"],
              additionalProperties: false,
            }
          },
          explanation_en: { type: "string" },
          explanation_es: { type: "string" },
          rubric: {
            type: "array",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                points: { type: "number" },
                description: { type: "string" },
              },
              required: ["criterion", "points", "description"],
              additionalProperties: false,
            }
          },
        },
        required: ["question_type", "question_en", "question_es", "difficulty",
                   "section_index", "options", "explanation_en", "explanation_es", "rubric"],
        additionalProperties: false,
      }
    }
  },
  required: ["questions"],
  additionalProperties: false,
};
```

### 5.4 Interactive AI Scenario Schema

For `interactive_ai` mode, we generate scenario cards (not individual questions):

```typescript
const scenarioSchema = {
  type: "object",
  properties: {
    scenarios: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scenario_en: { type: "string" },
          scenario_es: { type: "string" },
          role: { type: "string" },           // "server", "bartender", "line_cook"
          setting: { type: "string" },         // "dining room", "bar", "kitchen"
          evaluation_criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                criterion: { type: "string" },
                weight: { type: "number" },
                description: { type: "string" },
              },
              required: ["criterion", "weight", "description"],
              additionalProperties: false,
            }
          },
          expected_topics: {
            type: "array",
            items: { type: "string" },
          },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          section_index: { type: "number" },
        },
        required: ["scenario_en", "scenario_es", "role", "setting",
                   "evaluation_criteria", "expected_topics", "difficulty", "section_index"],
        additionalProperties: false,
      }
    }
  },
  required: ["scenarios"],
  additionalProperties: false,
};
```

### 5.5 Database Persistence

Questions are persisted to the (rebuilt) `quiz_questions` table:

```sql
INSERT INTO quiz_questions (
  course_id, section_id, question_type, question_en, question_es,
  options, rubric, explanation_en, explanation_es,
  difficulty, source, is_active, pool_generation_id
) VALUES (...);
```

The `pool_generation_id` groups all questions from one generation batch, making it easy to archive an entire pool during rebuild.

---

## 6. Phase B5: Image Generation Pipeline

**Goal**: Extend the existing `generate-image` function to support course-specific educational images.

### 6.1 Modified `generate-image` Edge Function

The existing function handles product photos (dishes, wines, cocktails). We add a new mode for course educational images.

#### Extended Request

```typescript
interface GenerateImageRequest {
  // Existing product mode
  productTable?: string;
  name?: string;
  prepType?: string;
  description?: string;
  category?: string;
  sessionId?: string;

  // NEW: Course mode
  mode?: 'product' | 'course';     // Default: 'product'
  course_id?: string;
  element_key?: string;
  image_type?: 'educational' | 'concept' | 'scenario' | 'infographic';
  prompt_override?: string;         // Admin can override the auto-generated prompt
  ai_instructions?: string;         // From the element's ai_instructions field
}
```

#### Course Image Prompt Builder

```typescript
function buildCourseImagePrompt(
  imageType: string,
  aiInstructions: string,
  elementTitle: string,
): string {
  const styleGuide = `Clean, professional, instructional style illustration.
NOT photorealistic for concepts — more like a high-quality infographic or training manual illustration.
White or light neutral background. No text overlays. Safe for workplace training materials.`;

  switch (imageType) {
    case 'educational':
      return `${styleGuide} Create an educational illustration showing: ${aiInstructions}. Context: ${elementTitle}`;
    case 'concept':
      return `${styleGuide} Create a concept diagram or visual explanation of: ${aiInstructions}. Context: ${elementTitle}`;
    case 'scenario':
      return `${styleGuide} Create a professional workplace scenario illustration showing: ${aiInstructions}. Restaurant/hospitality setting. No identifiable faces.`;
    case 'infographic':
      return `${styleGuide} Create a clean infographic-style illustration for: ${aiInstructions}. Use visual hierarchy, icons, and clear layout.`;
    default:
      return `${styleGuide} ${aiInstructions}`;
  }
}
```

#### Storage

- **Bucket**: `course-media` (NEW, private, 50MB limit)
- **Path**: `courses/{course_id}/elements/{element_key}/{timestamp}.png`
- **Size**: 1024x1024 (square, standard quality for cost efficiency)
- **Quality**: `standard` (not `hd` — saves cost, still good for training materials)

#### When NOT to Generate

The AI outline generator already knows when to use existing product images vs. generate new ones. The `image_source` field on media elements controls this:

| `image_source` | Behavior |
|---------------|----------|
| `product_image` | Fetch URL from the product record in DB. No generation. |
| `ai_generated` | Call `generate-image` with course mode. |
| `upload` | Placeholder shown — user uploads their own. |
| `external` | User provides a URL (YouTube thumbnail, etc.). |

---

## 7. Phase B6: Mandatory Rebuild Pipeline

**Goal**: When source material changes, automatically rebuild all affected course elements and quiz questions.

### 7.1 Change Detection Architecture

```
Source record updated (manual_section, product, etc.)
         │
         ▼
┌──────────────────────────────────────────────┐
│  content_change_log trigger fires            │
│                                              │
│  1. Compute MD5 of new content               │
│  2. Search course_sections.elements JSONB    │
│     for source_refs matching this record     │
│  3. If any match AND hash differs:           │
│     → Insert into content_change_log         │
│     → Trigger pg_notify('course_rebuild')    │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  pg_cron job (every 5 min) OR               │
│  pg_notify listener (immediate)              │
│                                              │
│  1. Read unprocessed content_change_log rows  │
│  2. Group by course_id                       │
│  3. Call rebuild-course edge function        │
│     for each affected course                 │
└──────────────────────────────────────────────┘
```

### 7.2 `content_change_log` Table

```sql
CREATE TABLE content_change_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  old_hash TEXT NOT NULL,
  new_hash TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now(),
  affected_courses JSONB,          -- [{course_id, section_id, element_keys[]}]
  rebuild_status TEXT DEFAULT 'pending',  -- 'pending' | 'processing' | 'completed' | 'failed'
  rebuild_started_at TIMESTAMPTZ,
  rebuild_completed_at TIMESTAMPTZ,
  rebuild_error TEXT
);
```

### 7.3 Change Detection Trigger

```sql
CREATE OR REPLACE FUNCTION fn_detect_content_change()
RETURNS TRIGGER AS $$
DECLARE
  _new_hash TEXT;
  _old_hash TEXT;
  _affected JSONB;
BEGIN
  -- Compute new hash based on table
  IF TG_TABLE_NAME = 'manual_sections' THEN
    _new_hash := md5(COALESCE(NEW.content_en, ''));
    _old_hash := md5(COALESCE(OLD.content_en, ''));
  ELSE
    -- For product tables, hash the full row as JSON
    _new_hash := md5(row_to_json(NEW)::TEXT);
    _old_hash := md5(row_to_json(OLD)::TEXT);
  END IF;

  -- Skip if content didn't actually change
  IF _new_hash = _old_hash THEN
    RETURN NEW;
  END IF;

  -- Find all course elements referencing this record
  SELECT jsonb_agg(jsonb_build_object(
    'course_id', cs.course_id,
    'section_id', cs.id,
    'element_keys', (
      SELECT jsonb_agg(elem->>'key')
      FROM jsonb_array_elements(cs.elements) AS elem
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(elem->'source_refs') AS ref
        WHERE ref->>'table' = TG_TABLE_NAME
          AND ref->>'id' = NEW.id::TEXT
          AND ref->>'content_hash' != _new_hash
      )
    )
  ))
  INTO _affected
  FROM course_sections cs
  WHERE cs.elements @> jsonb_build_array(
    jsonb_build_object('source_refs',
      jsonb_build_array(jsonb_build_object('table', TG_TABLE_NAME, 'id', NEW.id::TEXT))
    )
  );

  -- Only log if there are affected courses
  IF _affected IS NOT NULL AND jsonb_array_length(_affected) > 0 THEN
    INSERT INTO content_change_log (
      source_table, source_id, old_hash, new_hash, affected_courses
    ) VALUES (
      TG_TABLE_NAME, NEW.id, _old_hash, _new_hash, _affected
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
```

**Apply to all source tables**:
```sql
CREATE TRIGGER trg_detect_content_change_manual
  AFTER UPDATE ON manual_sections
  FOR EACH ROW EXECUTE FUNCTION fn_detect_content_change();

CREATE TRIGGER trg_detect_content_change_foh
  AFTER UPDATE ON foh_plate_specs
  FOR EACH ROW EXECUTE FUNCTION fn_detect_content_change();

-- ... same for wines, cocktails, prep_recipes, plate_specs, beer_liquor_list
```

### 7.4 Edge Function: `rebuild-course-elements`

> **⚠️ RENAMED** (Owner Decision): Was `rebuild-course`, now `rebuild-course-elements`. Element-level, admin-triggered.

**Endpoint**: `POST /functions/v1/rebuild-course-elements`
**Auth**: Manager/admin only (called by admin via UI notification banner, NOT automatically)

#### Request

```typescript
interface RebuildCourseElementsRequest {
  change_log_ids: string[];       // content_change_log row IDs to process
  course_id: string;
  affected_elements: Array<{
    section_id: string;
    element_keys: string[];
  }>;
}
```

#### Processing Flow

```
1. Mark change_log_id as 'processing'
2. For each affected section:
   a. Fetch the section's elements JSONB
   b. For each affected element_key:
      i.   Fetch UPDATED source material (the new content)
      ii.  Regenerate the element using its existing ai_instructions
      iii. Update source_refs[].content_hash with new hash
      iv.  Set element status to 'generated' (not 'reviewed' — needs re-review)
   c. Save updated elements JSONB
3. Archive existing quiz questions for affected sections
   (UPDATE quiz_questions SET is_active = false WHERE ...)
4. Call generate-quiz-pool internally to regenerate questions
5. Increment course.version
6. Create element_rebuild_log entries (per-element audit trail)
7. Mark change_log_ids as 'acknowledged'
8. Return summary: "Rebuilt N elements in M sections, regenerated X quiz questions"
```

### 7.5 Idempotency

Rebuilds are safe to retry:
- Each `content_change_log` row has a `rebuild_status` field
- If a rebuild fails midway, it can be retried from the beginning
- Element regeneration is idempotent — re-running with the same instructions + source material produces the same structural output (content may vary due to temperature, but that's acceptable)
- Quiz regeneration archives old questions first, so re-running just generates a new pool

### 7.6 `element_rebuild_log` Table (Admin Notification)

> **⚠️ RENAMED** (Owner Decision): Was `course_change_log`, now `element_rebuild_log`. Per-element rebuild audit trail.

```sql
CREATE TABLE element_rebuild_log (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id),
  change_log_id UUID REFERENCES content_change_log(id),
  old_version INTEGER NOT NULL,
  new_version INTEGER NOT NULL,
  elements_rebuilt INTEGER NOT NULL,
  questions_regenerated INTEGER NOT NULL,
  source_changes JSONB,            -- [{table, id, name, change_type}]
  admin_reviewed BOOLEAN DEFAULT false,
  admin_reviewed_by UUID REFERENCES auth.users(id),
  admin_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 7.7 Notification Flow

```sql
-- Insert notification for admin alert banner
INSERT INTO admin_notifications (
  group_id, notification_type, title, body, metadata, dismissed
) VALUES (
  _group_id,
  'course_rebuild',
  'Course Updated Automatically',
  '"Server Wine Training" was rebuilt because source material changed.',
  jsonb_build_object(
    'course_id', _course_id,
    'change_log_id', _change_log_id,
    'elements_rebuilt', _elements_count,
    'questions_regenerated', _questions_count
  ),
  false
);
```

---

## 8. Phase B7: Credit & Usage Tracking

**Goal**: Define credit costs for all course builder actions and integrate with the existing credit pipeline.

### 8.1 Credit Cost Table Entries

New rows for `credit_costs`:

| Domain | Action Type | Credits | Rationale |
|--------|-------------|---------|-----------|
| `course_builder` | `outline` | 2 | One AI call, ~4K output tokens |
| `course_builder` | `content_section` | 1 | Per section content generation |
| `course_builder` | `content_element` | 1 | Single element regeneration |
| `course_builder` | `chat_edit` | 1 | AI chat panel edit |
| `course_builder` | `quiz_pool` | 3 | Generating 30 questions (2 AI calls) |
| `course_builder` | `image` | 2 | DALL-E 3 generation (higher API cost) |
| `course_builder` | `rebuild` | 0 | Free — system-initiated, not user-initiated |
| `course_player` | `tutor` | 1 | Same as existing Q&A |
| `course_player` | `quiz_mc` | 0 | MC grading is server-side, no AI |
| `course_player` | `quiz_voice` | 1 | Voice evaluation uses AI |
| `course_player` | `quiz_interactive` | 5 | Realtime API session (~$0.10/min) |
| `course_player` | `evaluation` | 1 | Section/module evaluation |

### 8.2 Integration Pattern

All new edge functions use the shared credit pipeline:

```typescript
import { getCreditCost, trackAndIncrement } from "../_shared/credit-pipeline.ts";

// Before returning the response:
const credits = await getCreditCost(supabase, groupId, "course_builder", "outline");
const usageResult = await trackAndIncrement(supabase, userId, groupId, credits, {
  domain: "course_builder",
  action: "outline",
  edge_function: "build-course",
  model: "gpt-4o-mini",
  tokens_input: inputTokenCount,
  tokens_output: outputTokenCount,
});
```

### 8.3 Usage Limits for Course Building

Course building actions share the same daily/monthly limits as Q&A (from `role_policies`). The difference is the credit cost per action — a single "Build All" course generation might consume 2 (outline) + 5 (content, 5 sections) + 3 (quiz pool) = **10 credits** total.

For the admin role (100 daily / 2000 monthly), this means ~10 full course builds per day, which is more than sufficient.

---

## 9. Phase B8: Voice Integration (Interactive AI Quiz)

**Goal**: Enable Interactive AI quiz mode where the AI conducts a real-time voice conversation to assess the student.

### 9.1 Architecture

Interactive AI quiz reuses the existing `realtime-session` edge function with a new mode:

```typescript
// Request to realtime-session
{
  groupId: string,
  language: 'en' | 'es',
  // NEW: Quiz mode fields
  quiz_mode: 'interactive_ai',
  course_id: string,
  section_id?: string,      // Optional — if null, covers entire course
  scenario_id: string,      // ID of the quiz_questions row (scenario type)
  attempt_id: string,       // quiz_attempt already created
}
```

### 9.2 System Prompt Assembly for Quiz Voice

```typescript
// In realtime-session, when quiz_mode === 'interactive_ai':

const scenario = await supabase
  .from('quiz_questions')
  .select('*')
  .eq('id', scenarioId)
  .single();

const systemPrompt = `You are an AI assessor for Alamo Prime steakhouse.

SCENARIO: ${scenario.question_en}
ROLE: You are playing the role of a ${scenario.role} in the ${scenario.setting}.

EVALUATION CRITERIA:
${scenario.evaluation_criteria.map(c => `- ${c.criterion} (${c.weight}%): ${c.description}`).join('\n')}

EXPECTED TOPICS TO COVER:
${scenario.expected_topics.join(', ')}

INSTRUCTIONS:
1. Stay in character for the scenario
2. Ask follow-up questions to probe deeper understanding
3. If the student struggles, provide gentle guidance but note it as a teaching moment
4. After 3-5 exchanges, begin wrapping up
5. Do NOT reveal the evaluation criteria or your assessment during the conversation
6. Respond in ${language === 'es' ? 'Spanish' : 'English'}`;
```

### 9.3 Post-Session Evaluation

After the WebRTC session ends, the client calls `course-evaluate` with `action: 'conversation_evaluation'` (existing function). The transcript from the realtime session is stored in `conversation_messages` and evaluated using the same dual-feedback pattern.

### 9.4 Credit Warning

The UI shows a credit warning before starting an Interactive AI session (as specified in the overview, Section 6.4). The credit cost is looked up via `getCreditCost(supabase, groupId, 'course_player', 'quiz_interactive')` and displayed to the user.

---

## 10. Token Budget Analysis

### 10.1 Source Material Size Estimates

| Content Type | Avg Size | Token Estimate |
|-------------|----------|---------------|
| Manual section (full) | 2,000-4,000 words | 2,500-5,000 tokens |
| Section chunk | 300-800 words | 375-1,000 tokens |
| Product record (serialized) | 200-500 words | 250-625 tokens |
| Prep recipe (with sub-recipes) | 500-1,500 words | 625-1,875 tokens |

### 10.2 Context Window Usage by Operation

**Outline generation** (most source-material-heavy):
```
System prompt:        ~800 tokens
Source material:
  5 manual sections:  ~15,000 tokens (5 * 3,000 avg)
  10 products:        ~4,000 tokens (10 * 400 avg)
  Wizard context:     ~200 tokens
Total input:          ~20,000 tokens
Output (outline):     ~3,000 tokens
─────────────────────
Total:                ~23,000 tokens (well within 128K)
```

**Content generation** (per element):
```
System prompt:        ~500 tokens
Element instructions: ~100 tokens
Source material:      ~3,000 tokens (1-2 relevant sections)
Total input:          ~3,600 tokens
Output (content):     ~1,500 tokens
─────────────────────
Total:                ~5,100 tokens per element
```

**Quiz generation** (per batch of 15):
```
System prompt:        ~500 tokens
Course content:       ~15,000 tokens (all section content)
Source material:      ~10,000 tokens (original sources for fact-checking)
Total input:          ~25,500 tokens
Output (15 questions): ~3,000 tokens
─────────────────────
Total:                ~28,500 tokens per batch
```

### 10.3 Maximum Course Size

With 128K context window on gpt-4o-mini:
- **Outline generation**: Up to ~100,000 tokens of source material (40+ manual sections)
- **Content generation**: No limit (each element is independent)
- **Quiz generation**: Up to ~90,000 tokens of course content per batch

**Practical limit**: A course built from 20 manual sections + 30 products = ~75K tokens of source material. This fits comfortably. For courses requiring more source material, we implement a relevance-scoring step that prioritizes the most important sections.

### 10.4 Truncation Strategy

If source material exceeds 80K tokens:
1. Calculate token count per source item
2. Sort by relevance to the course topic (using the wizard type as a guide)
3. Include the most relevant items first
4. Truncate with a note: "Note: Some source material was excluded due to length. The following sources were prioritized: ..."
5. The AI can still produce a complete outline — it just won't reference truncated material

---

## 11. Error Handling & Idempotency

### 11.1 Outline Generation Failures

| Failure | Recovery |
|---------|----------|
| OpenAI API error (5xx) | Retry up to 2 times with exponential backoff (1s, 2s) |
| OpenAI rate limit (429) | Retry after `Retry-After` header value |
| Invalid JSON response | Retry once. If still invalid, return error to UI. |
| Truncated response | Increase `max_tokens` and retry once. |
| Auth failure | Return 401, no retry. |

### 11.2 Content Generation Failures (Mid-Course)

Content is generated element-by-element. If one element fails:
1. Mark that element as `status: 'error'` with an error message
2. Continue with the next element (do NOT stop the entire build)
3. Return the list of failed elements in the response
4. UI shows which elements failed with a "Retry" button per element

### 11.3 Quiz Generation Failures

If quiz generation fails:
1. The course is still valid (quiz is optional until publication)
2. Return an error indicating quiz generation failed
3. Admin can retry quiz generation from the builder UI
4. No partial state — either all questions are generated or none are

### 11.4 Rebuild Idempotency

Rebuilds are designed to be safely retried:
- `content_change_log.rebuild_status` prevents double-processing
- Element regeneration is stateless — same inputs produce valid (if slightly different) output
- Quiz archive + regenerate is atomic per course
- If rebuild fails midway:
  - Some elements may be regenerated, others still stale
  - The `rebuild_status` stays `processing` or goes to `failed`
  - A retry processes ALL affected elements again (idempotent)
  - Version increment only happens on full success

### 11.5 Concurrent Edit Protection

The overview mentions "optimistic concurrency" for auto-save. For AI operations:
- Each `course_sections` row has an `updated_at` field
- Before saving AI-generated content, check that `updated_at` hasn't changed since we fetched
- If it has changed (another edit happened), return a conflict error
- UI handles conflict resolution (reload + re-apply)

---

## 12. Edge Function Summary Table

| Function | Method | Auth | Model | Input | Output | Credits |
|----------|--------|------|-------|-------|--------|---------|
| `build-course` (outline) | POST | getUser | gpt-4o-mini | Source material + wizard config | Outline JSONB | 2 |
| `build-course` (content) | POST | getUser | gpt-4o-mini | Outline + source per element | Generated elements | 1/section |
| `build-course` (chat_edit) | POST | getUser | gpt-4o-mini | Elements array + instruction | Modified elements | 1 |
| `build-course-element` | POST | getUser | gpt-4o-mini | Element + instructions + source | Updated element | 1 |
| `generate-quiz-pool` | POST | getUser | gpt-4o-mini | Course content + source material | Question pool (30) | 3 |
| `generate-image` (course) | POST | getUser | dall-e-3 | Image type + instructions | Stored image URL | 2 |
| `rebuild-course` | POST | Service role | gpt-4o-mini | Change log + affected elements | Rebuilt elements + quiz | 0 |
| `embed-sections` (chunks) | POST | Service role | text-embedding-3-small | Chunk text | Embedding vectors | 0 |

---

## 13. Data Flow Diagrams

### 13.1 Course Creation Flow

```
Admin opens Course Builder
         │
         ▼
Selects Wizard Type (e.g., "Menu Rollout")
         │
         ▼
Fills wizard steps:
  - Title, description
  - Selects products (5 dishes, 3 wines)
  - Selects manual sections (Steps of Service, Wine Knowledge)
  - Chooses teacher level: "Professional"
  - Assessment: "Mixed" (MC + voice)
         │
         ▼
Clicks "Build Course"
         │
         ├──────────────────────────────────────┐
         ▼                                      │
  build-course (step: 'outline')                │
         │                                      │
         ├─ Fetch full sections (get_full_sections)
         ├─ Fetch full products (SELECT * FROM ...)
         ├─ Compute MD5 hashes for source_refs
         ├─ Assemble source material (~20K tokens)
         ├─ Call gpt-4o-mini (structured JSON)
         ├─ Parse outline
         ├─ INSERT courses row
         ├─ INSERT course_sections rows with elements JSONB
         ▼
  Returns outline to UI (5-10 seconds)
         │
         ▼
Admin reviews outline:
  - Reorders elements ✓
  - Deletes one element ✓
  - Edits ai_instructions on another ✓
  - Adds a new Feature element from palette ✓
         │
         ▼
Clicks "Build All Content"
         │
         ▼
  build-course (step: 'content')
         │
         ├─ For each section:
         │    ├─ For each element (status: 'outline'):
         │    │    ├─ Fetch relevant source from source_refs
         │    │    ├─ Call gpt-4o-mini (element-specific schema)
         │    │    ├─ Update element.body_en, body_es
         │    │    └─ Set status: 'generated'
         │    └─ Save section
         │
         ├─ Report progress (section 1/5... 2/5... etc.)
         ▼
  Returns (30-60 seconds)
         │
         ▼
"Generate images too?"
         │
    [Yes] ├──── generate-image (course mode) for each ai_generated media element
         │
         ▼
Admin reviews + publishes
         │
         ▼
  generate-quiz-pool (30 questions)
         │
         ▼
Course live in Course Player
```

### 13.2 Mandatory Rebuild Flow

```
Admin updates a wine description in the database
         │
         ▼
UPDATE wines SET description = '...' WHERE id = '...'
         │
         ▼
Trigger: fn_detect_content_change()
         │
         ├─ Compute MD5 of new description
         ├─ Search course_sections.elements for source_refs matching this wine
         ├─ Found: "Server Wine Training" course, section 2, elements [body-1, tip-1]
         ├─ Hash differs from stored content_hash
         │
         ▼
INSERT INTO content_change_log (...)
         │
         ▼
pg_cron (every 5 min) detects pending change_log rows
         │
         ▼
Calls rebuild-course edge function
         │
         ├─ Fetch updated wine record (full data)
         ├─ For element body-1:
         │    ├─ Re-read ai_instructions
         │    ├─ Call gpt-4o-mini with updated wine data
         │    ├─ Update body_en, body_es
         │    └─ Update source_refs[].content_hash
         ├─ For element tip-1:
         │    └─ Same process
         │
         ├─ Archive old quiz questions (is_active = false)
         ├─ Generate new quiz pool (generate-quiz-pool internal call)
         │
         ├─ Increment course version (v1 → v2)
         ├─ Insert course_change_log entry
         ├─ Insert admin_notification entry
         ▼
Admin sees alert banner:
  "Server Wine Training was automatically rebuilt
   because Veuve Clicquot description was updated.
   3 elements regenerated, 8 quiz questions regenerated."
```

### 13.3 AI Q&A Search Flow (Post-Chunking)

```
User asks: "What's our policy on guest complaints?"
         │
         ▼
/ask edge function
         │
         ├─ Generate query embedding (text-embedding-3-small)
         ├─ Call search_manual_v2 (NOW searches section_chunks)
         │    ├─ FTS on chunk search_vector_en
         │    ├─ Vector search on chunk embedding_en
         │    ├─ RRF combines scores
         │    └─ Returns top 5 chunks with section metadata
         │
         ├─ Fetch full sections for top 3 chunks (via section_id → manual_sections)
         ├─ Inject full section content into AI context
         ├─ Call gpt-4o-mini
         │
         ▼
Returns answer with citations
```

---

## 14. Prompt Templates

### 14.1 Course Outline Generator

**Slug**: `course-outline-generator`
**Category**: `course_builder`

```
You are an expert course builder for Alamo Prime, a premium steakhouse in Miami. You create professional restaurant training courses.

TASK: Generate a course outline from the source material provided. The outline defines the structure — what topics to cover, in what order, with what types of content elements.

WIZARD TYPE: {wizard_type}
COURSE TITLE: {course_title}
COURSE DESCRIPTION: {course_description}
TEACHER LEVEL: {teacher_level}
ADMIN INSTRUCTIONS: {ai_instructions}

ELEMENT TYPES YOU CAN USE:
1. content — Rich markdown text block (headers, lists, tables, bold). Use for main educational content.
2. feature — Highlighted callout box. Variants:
   - tip (blue) — helpful advice, shortcuts
   - best_practice (green) — recommended approach
   - caution (amber) — things to watch out for
   - warning (red) — critical safety/allergen info
   - did_you_know (purple) — interesting facts, guest talking points
   - key_point (indigo) — must-remember information
3. media — Image placeholder. Set image_source to:
   - product_image — if a real product photo exists in the database (ALWAYS prefer this for dishes, wines, cocktails, beer/spirits)
   - ai_generated — for educational illustrations, concept diagrams, or scenario images (NOT for products that have real photos)
   - upload — placeholder for user to add their own photo/video

RULES:
1. Each section should have 3-8 elements
2. Start each section with a content element (introduction)
3. End each section with a key_point feature element (summary)
4. Add warning elements for allergen-critical content
5. Add tip elements for guest-facing talking points
6. For Menu Rollout: one section per item OR group related items
7. For SOP Review: one section per major procedure
8. For Steps of Service: one section per service step
9. Use ai_instructions to describe WHAT the AI should write for each element
10. Reference specific source material in ai_instructions (e.g., "Using the Veuve Clicquot data, write about...")
11. NEVER hallucinate product data — only reference products that appear in the source material
12. Generate bilingual titles (title_en + title_es)
13. Assign unique keys to each element (e.g., "intro-1", "tip-steaks", "img-veuve")
14. Set sort_order sequentially within each section
15. For source_refs, include ALL source records that are relevant to each element

SOURCE MATERIAL:
{assembled_source_material}
```

### 14.2 Content Element Generator

**Slug**: `course-content-element`
**Category**: `course_builder`

```
You are writing content for a restaurant training course. Generate the full markdown body for this content element.

ELEMENT: {element_title}
INSTRUCTIONS: {ai_instructions}
TEACHER LEVEL: {teacher_level}

SOURCE MATERIAL:
{relevant_source_material}

RULES:
1. Write in markdown: use headers (##, ###), bullet lists, numbered lists, tables, bold, italic
2. Be accurate — use ONLY data from the source material. Never invent facts.
3. If referencing specific quantities, temperatures, or times, cite them exactly from the source
4. Match the teacher level tone:
   - friendly: casual, encouraging, analogies
   - professional: clear, structured, balanced
   - strict: direct, precise, no-nonsense
   - expert: deep, industry context, assumes baseline knowledge
5. Generate BOTH English (body_en) and Spanish (body_es)
6. Spanish should be a natural translation, not a literal word-for-word translation
7. Target 200-500 words per content element
```

### 14.3 Feature Element Generator

**Slug**: `course-feature-element`
**Category**: `course_builder`

```
Generate a callout/highlight box for a restaurant training course.

VARIANT: {variant}
INSTRUCTIONS: {ai_instructions}
TEACHER LEVEL: {teacher_level}

SOURCE MATERIAL:
{relevant_source_material}

RULES:
1. Keep it concise: 1-3 sentences for tips/best_practices, up to 5 for warnings
2. Match the variant's purpose:
   - tip: actionable advice the trainee can use immediately
   - best_practice: the recommended way to do something
   - caution: something to watch out for (not critical)
   - warning: CRITICAL safety, allergen, or legal information
   - did_you_know: interesting facts that help with guest conversations
   - key_point: the single most important takeaway
3. For warnings: be specific about allergens, temperatures, or procedures
4. Generate both body_en and body_es
5. Use bold (**text**) for emphasis on the key point
```

### 14.4 Quiz Pool Generator

**Slug**: `course-quiz-pool-generator`
**Category**: `course_builder`

```
Generate a pool of quiz questions for a restaurant training course. Questions test knowledge of the course content and must be answerable from the source material.

COURSE: {course_title}
TOTAL QUESTIONS: {pool_size}
QUESTION TYPES: {mc_count} multiple choice, {voice_count} voice response

COURSE CONTENT (what the student learned):
{course_content}

SOURCE MATERIAL (ground truth for fact-checking):
{source_material}

RULES FOR MULTIPLE CHOICE:
1. 4 options per question, exactly 1 correct
2. Distractors should be plausible but clearly wrong to someone who studied
3. For quantities/temps/times, use close but incorrect values as distractors
4. Mix difficulty: 30% easy, 50% medium, 20% hard
5. Distribute questions across all course sections (use section_index)
6. Include 1-2 allergen/safety questions per section where applicable
7. Generate bilingual (question_en, question_es, option text_en, text_es)
8. Write clear explanations for correct answers (explanation_en, explanation_es)
9. Do NOT include "All of the above" or "None of the above" options

RULES FOR VOICE QUESTIONS:
1. Ask open-ended questions that test verbal articulation
2. Good for: "Describe X to a guest", "Walk me through Y", "Explain why Z"
3. Define a rubric with 3-5 criteria, each worth specific points (totaling 100)
4. Criteria examples: accuracy (40 pts), completeness (30 pts), hospitality tone (15 pts), confidence (15 pts)

GENERAL RULES:
1. Never ask trick questions
2. Never test obscure trivia — focus on practical, job-relevant knowledge
3. Reference specific products, procedures, or standards from the source material
4. For allergen questions, always include the correct allergens from the source data
```

### 14.5 Rebuild Element Prompt

**Slug**: `course-rebuild-element`
**Category**: `course_builder`

```
You are regenerating a course element because the source material has changed. The original element was built with specific instructions — follow those same instructions but use the UPDATED source material.

ORIGINAL INSTRUCTIONS: {ai_instructions}
ELEMENT TYPE: {element_type}
ELEMENT TITLE: {element_title}

UPDATED SOURCE MATERIAL:
{new_source_material}

PREVIOUS CONTENT (for reference — DO NOT copy, regenerate from new source):
{old_body_en}

RULES:
1. Follow the original instructions exactly
2. Use the UPDATED source material — it may have new data, changed descriptions, or modified procedures
3. Maintain the same structural format as the previous content (headers, lists, tables)
4. If the source change is minor (e.g., a description rewording), the new content should be similar
5. If the source change is major (e.g., a new allergen, changed temp), highlight the change clearly
6. Generate both body_en and body_es
```

---

## Appendix: Migration Dependency Order

```
Phase B1 (Chunking):
  Migration 1: Create section_chunks table + indexes + RLS
  Migration 2: Create fn_chunk_section() PL/pgSQL function
  Migration 3: Create fn_chunk_all_sections() + run initial chunking
  Migration 4: Create trg_rechunk_on_content_update trigger
  Migration 5: Update search_manual_v2 to query section_chunks
  Migration 6: Create get_full_sections function
  Deploy: embed-sections (modified for chunks mode)
  Run: embed-sections with mode='chunks' to generate all chunk embeddings

Phase B2 (Course Generation):
  Deploy: build-course
  (Tables are created by the DB phase, not this plan)

Phase B3 (Element Regeneration):
  Deploy: build-course-element
  (No new tables — uses existing course_sections)

Phase B4 (Quiz Generation):
  Deploy: generate-quiz-pool
  (Uses existing quiz_questions table, rebuilt by DB phase)

Phase B5 (Image Generation):
  Migration 7: Create course-media storage bucket
  Deploy: generate-image (modified for course mode)

Phase B6 (Mandatory Rebuild):
  Migration 8: Create content_change_log table
  Migration 9: Create course_change_log table
  Migration 10: Create admin_notifications table
  Migration 11: Create fn_detect_content_change() + triggers on all source tables
  Migration 12: Create pg_cron job for rebuild polling
  Deploy: rebuild-course

Phase B7 (Credits):
  Migration 13: Insert credit_costs rows for course_builder domain

Phase B8 (Voice):
  No new edge functions — extends realtime-session (already deployed)
  Requires quiz_questions with scenario type (created by DB phase)
```
