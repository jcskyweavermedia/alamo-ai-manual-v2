# Course Builder -- Master Implementation Plan

> Unified phased plan synthesizing the Database, Frontend, and AI/Backend architect plans.
> Incorporates all Devil's Advocate findings. Each phase is independently deployable and testable.
> This is the working document for building the feature.

---

## Design Decisions from Devil's Advocate Review

These critical findings shaped the plan structure. Every one is addressed in a specific phase. Owner decisions recorded 2026-03-05.

| # | Finding | Severity | Owner Decision | Where Addressed |
|---|---------|----------|----------------|-----------------|
| 1 | **Teardown sequencing** -- drop order matters, preserve shared helpers, archive data, stub training UI before dropping | CRITICAL | **APPROVED as-is.** Leaf tables first, `get_user_group_id`/`get_user_role`/`set_updated_at` NEVER dropped, data archived, stub UI placed before tables drop. | Phase 2 |
| 2 | **Auto-rebuild storms** -- 20 product changes = 50 simultaneous rebuilds, cost explosion, quality degradation | CRITICAL | **REDESIGNED as element-level rebuilds.** The primary rebuild scenario is menu item changes. When a menu item changes, the system rebuilds only the affected elements referencing that item + regenerates quiz questions for those sections. NOT a full course rebuild — surgical, per-element. Admin still triggers via notification. Auto-rebuild toggle added later (Phase 8). | Phase 6 (element-level rebuild), Phase 8 (optional auto) |
| 3 | **Scope creep** -- full feature is 3-4x Form Builder scope | CRITICAL | **Building the whole thing, phased.** We start with Menu Rollout wizard, battle-test it, then build the remaining 4 wizards one at a time in later phases. Each wizard must be proven before moving to the next. MVP = Phases 1-5 (mockup, teardown, builder core, Menu Rollout wizard + AI, quiz MC). | Phases 4 (Menu Rollout), Phase 8 (SOP Review + Steps of Service), Phase 9 (Line Cook + Custom + Start Blank) |
| 4 | **Search function changes** -- never modify `search_manual_v2` in place | HIGH | **APPROVED.** Create new `search_manual_chunks()` function. Keep `search_manual_v2` as fallback. Chunking is additive. | Phase 7 |
| 5 | **Chunking** -- not a prerequisite for Course Builder, which uses full sections | HIGH | **Prep for chunking, defer execution.** Build Menu Rollout first. Once that works, convert existing manuals to have proper chunks. Dedicated phase for manual migration/conversion. | Phase 7 (chunking infrastructure + manual conversion) |
| 6 | **Image generation** -- not needed for MVP | MEDIUM | **OVERRIDDEN — include from day one.** AI image generation is essential for making courses visually engaging and not text-heavy. This is for educational illustrations, concept diagrams, and media elements — NOT for dish photos (those come from the DB). The user decides whether to use AI images. Moved to Phase 4 alongside the AI pipeline. | Phase 4 |
| 7 | **Quiz modes** -- start simple | MEDIUM | **APPROVED.** MVP = Multiple Choice only. Voice Response in Phase 7. Interactive AI (realtime) in Phase 9. Build in phases. | Phase 5 (MC), Phase 7 (voice), Phase 9 (interactive) |

---

## Phase Overview

```
Phase 1: HTML Mockup                        [No deps -- start immediately]
Phase 2: Teardown + Foundation              [DB teardown + core tables + stub UI]
Phase 3: Builder Core                       [Types, context, element system, canvas]
Phase 4: Menu Rollout Wizard + AI Pipeline  [First wizard + build-course + build-course-element + image gen]
Phase 5: Quiz Builder + Course Player MVP   [MC quiz + basic player -- training section is live again]
Phase 6: Stale Detection + Element Rebuild  [Content change log + element-level rebuild + admin notifications]
Phase 7: Manual Migration + Chunking + Voice Quiz  [Convert manuals, chunking infra, search upgrade, voice quiz]
Phase 8: Additional Wizards (SOP Review + Steps of Service) [Battle-tested one at a time]
Phase 9: Remaining Wizards + Interactive AI + Polish [Line Cook, Custom, Start Blank, realtime quiz, auto-rebuild, mobile]
```

**MVP Boundary**: Phases 1-5 deliver a working Course Builder with Menu Rollout wizard, AI content + image generation, MC quiz, and a functional Course Player. Staff can take courses again.

**Wizard Strategy**: We build ONE wizard at a time, battle-test it, then move to the next. Menu Rollout is first (Phase 4). Each subsequent wizard is its own phase milestone, reusing shared components from Phase 4.

**Existing training UI stays running** until Phase 5 is complete. The teardown in Phase 2 removes old DB tables but immediately rebuilds the new ones, and places a stub UI ("Course Builder coming soon") in the training routes so the app never has a broken section.

---

## Phase 1: HTML Design Mockup

**Goal**: Validate the entire UI concept before writing production code. Clickable HTML/CSS prototype.

**Duration estimate**: 1-2 sessions

**Dependencies**: None -- start immediately

### Deliverables

| File | Content |
|------|---------|
| `mockup/index.html` | Hub page linking to all mockup screens |
| `mockup/editor.html` | Course Builder editor: 3-column desktop (palette / canvas / AI panel), mobile tabs |
| `mockup/wizard.html` | Custom Course wizard steps (6 steps, clickable navigation) |
| `mockup/player.html` | Course Player: section rendering with element types, quiz MC |
| `mockup/dashboard.html` | Manager dashboard: stats cards, team progress table |
| `mockup/alerts.html` | Full-width stale-content notification banner |

### What Gets Validated

1. Three-column layout: palette (176px) / canvas (flex) / AI panel (40%)
2. Element cards in outline state vs. generated state
3. Content element with rendered Markdown (tables, lists, headers)
4. All 6 feature element variants (tip/best_practice/caution/warning/did_you_know/key_point)
5. Media element (image placeholder, YouTube embed placeholder)
6. Per-element controls: up/down arrow buttons (left side), AI button, edit, delete
7. Wizard step indicators and form layouts
8. Quiz configuration panel (MC mode)
9. Teacher level selector (4 levels)
10. Source material picker with search
11. iPad breakpoint (3-column preserved, palette collapses to icons)
12. Phone breakpoint (tab switching: Canvas / Elements / AI)
13. Full-width stale-content alert banner

### Acceptance Criteria

- [ ] All 6 HTML files render correctly in Chrome, Safari, Firefox
- [ ] Mobile breakpoints work (resize browser to 375px, 768px, 1024px)
- [ ] Feature variant colors are visually distinct
- [ ] Wizard steps navigate forward/back
- [ ] Team reviews and approves the design direction

---

## Phase 2: Teardown + Foundation

**Goal**: Remove all existing training tables and code, rebuild the core DB schema, and place a stub UI so the app never breaks. This is the most delicate phase -- sequencing is critical.

**Duration estimate**: 2-3 sessions

**Dependencies**: Phase 1 reviewed (design direction approved)

### 2.1 Pre-Teardown Safety Steps

**CRITICAL**: Before dropping anything, these steps happen FIRST:

1. **Archive existing data** (for reference, not restoration):
   ```sql
   -- Run as a one-time script, NOT a migration
   -- Export to JSON files or a separate archive schema
   CREATE SCHEMA IF NOT EXISTS archive;
   CREATE TABLE archive.courses_backup AS SELECT * FROM public.courses;
   CREATE TABLE archive.course_sections_backup AS SELECT * FROM public.course_sections;
   CREATE TABLE archive.training_programs_backup AS SELECT * FROM public.training_programs;
   -- etc. for all 18 tables being dropped
   ```

2. **Verify `/ask` edge function does NOT depend on training tables** -- it queries `manual_sections` (preserved) and product tables (preserved). Confirm no code path references `courses` or `course_sections`.

3. **Verify shared helper functions are NOT dropped**:
   - `get_user_group_id()` -- PRESERVED
   - `get_user_role()` -- PRESERVED
   - `set_updated_at()` -- PRESERVED
   - These are used by the entire application, not just training.

### 2.2 DB Migration 1: Teardown

**File**: `20260306100000_cb_teardown.sql`

**Drop order** (leaf tables first, root tables last):

```
Step 0: Remove cron job (cleanup-training-data)
Step 1: Drop training-specific functions (5 functions)
        - sync_program_enrollment_on_course_complete()
        - cleanup_expired_training_data()
        - expire_rollouts()
        - detect_content_changes(UUID)
        - get_team_progress(UUID)
Step 2: Drop Tier 4 -- deepest leaf tables
        - conversation_messages, module_test_answers, quiz_attempt_answers
Step 3: Drop Tier 3
        - module_test_attempts, quiz_attempts, tutor_sessions
Step 4: Drop Tier 2
        - quiz_questions, evaluations, section_progress, course_conversations,
          rollout_assignments, content_change_log, program_enrollments
Step 5: Drop Tier 1
        - rollouts, course_enrollments, course_sections
Step 6: Drop Tier 0 -- root tables
        - courses, training_programs
Step 7: Clean up orphaned AI prompt seeds (training-specific slugs only)
        - Keep assessment-conductor, conversation-evaluator for rebuild
```

**NEVER dropped**:
- `ai_teachers` (serves broader AI system)
- `ai_prompts` (serves broader AI system, only training-specific slugs deleted)
- `manual_sections` (the content source -- untouched)
- All product tables (untouched)
- `get_user_group_id()`, `get_user_role()`, `set_updated_at()`

### 2.3 DB Migration 2: Core Course Tables

**File**: `20260306100100_cb_core_tables.sql`

Creates the 3 foundational tables the Course Builder writes to:

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `training_programs` | id, group_id, slug, title_en/es, status, category, icon, sort_order | Program groupings (optional) |
| `courses` | id, group_id, slug, title_en/es, course_type, teacher_level, quiz_config JSONB, status, version, wizard_config JSONB | Course definitions with element-based architecture |
| `course_sections` | id, course_id, slug, title_en/es, **elements JSONB** (the core), source_refs JSONB, generation_status, section_type | Lesson definitions with JSONB element arrays |

Key details:
- `courses.status` CHECK: `draft`, `outline`, `generating`, `review`, `published`, `archived`
- `courses.course_type` CHECK: `menu_rollout`, `sop_review`, `steps_of_service`, `line_cook`, `custom`, `blank`
- `course_sections.elements` has CHECK constraint enforcing JSONB array
- GIN indexes on `elements` and `source_refs` for JSONB queries
- All 3 tables use `set_updated_at()` trigger (shared, not recreated)
- 15 RLS policies across 3 tables (SELECT for users, full CRUD for managers/admins)

### 2.4 DB Migration 3: Storage Bucket + AI Prompts

**File**: `20260306100200_cb_storage_and_prompts.sql`

- `course-media` storage bucket (private, 50MB limit, jpeg/png/webp/gif/mp4)
- 4 storage RLS policies
- 3 AI prompt seeds: `course-outline-generator`, `course-element-builder`, `quiz-pool-generator`

### 2.5 DB Migration 4: get_full_sections() Function

**File**: `20260306100300_cb_get_full_sections.sql`

```sql
CREATE OR REPLACE FUNCTION public.get_full_sections(section_ids UUID[])
RETURNS TABLE (
  id UUID, slug TEXT, title_en TEXT, title_es TEXT,
  content_en TEXT, content_es TEXT,
  category TEXT, tags TEXT[],
  word_count_en INTEGER, word_count_es INTEGER, updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT id, slug, title_en, title_es, content_en, content_es,
         category, tags, word_count_en, word_count_es, updated_at
  FROM public.manual_sections
  WHERE id = ANY(section_ids) AND is_category = false
  ORDER BY sort_order;
$$;
```

This is the Course Builder's source material function. Returns complete, untruncated section content. No chunking, no embeddings -- the AI gets everything.

### 2.6 Frontend: Teardown Old + Stub New

**Files deleted** (~52 files):
- 8 pages: TrainingHome, ProgramDetail, CourseDetail, LearningSession, QuizPage, ModuleTestPage, PracticeTutorPage, ManagerTrainingDashboard
- 27 training components
- 16 training hooks
- 1 type file (types/training.ts)

**Routes removed** from App.tsx:
- `/courses/*` (all training routes)
- `/admin/training`

**Stub UI added** (immediately, same commit as teardown):
- New route `/courses` -> `CourseComingSoonPage.tsx` (simple page: "Course Builder coming soon. The training section is being rebuilt with a new AI-powered Course Builder.")
- Navigation link updated to point to the stub
- This ensures the app never has a broken training section

### 2.7 Credit Cost Seeds

**File**: `20260306100400_cb_credit_costs.sql`

| Domain | Action | Credits | Rationale |
|--------|--------|---------|-----------|
| `course_builder` | `outline` | 2 | One AI call, ~4K output tokens |
| `course_builder` | `content_section` | 1 | Per-section content generation |
| `course_builder` | `content_element` | 1 | Single element regeneration |
| `course_builder` | `chat_edit` | 1 | AI chat panel edit |
| `course_builder` | `quiz_pool` | 3 | Generating question pool |
| `course_builder` | `image` | 2 | DALL-E generation (Phase 4) |
| `course_builder` | `rebuild` | 0 | System-initiated, free |
| `course_player` | `tutor` | 1 | AI teacher chat |
| `course_player` | `quiz_mc` | 0 | Server-side grading, no AI |
| `course_player` | `quiz_voice` | 1 | Voice evaluation |
| `course_player` | `quiz_interactive` | 5 | Realtime API |

### Acceptance Criteria

- [ ] All 18 old training tables dropped
- [ ] `ai_teachers`, `ai_prompts`, `manual_sections`, all product tables intact
- [ ] `get_user_group_id()`, `get_user_role()`, `set_updated_at()` intact
- [ ] 3 new tables created: `training_programs`, `courses`, `course_sections`
- [ ] `course-media` storage bucket created
- [ ] 3 AI prompts seeded
- [ ] `get_full_sections()` function works (returns full section content by ID array)
- [ ] App compiles with 0 TS errors
- [ ] `/courses` route shows stub page
- [ ] `/ask` edge function still works (no regression)
- [ ] All 15+ RLS policies active on new tables
- [ ] Archive tables exist in `archive` schema

---

## Phase 3: Builder Core (Types + Context + Element System)

**Goal**: Build the Course Builder's type system, state management, page shell, and the complete element editing experience. After this phase, an admin can create a course manually (no AI yet) by adding elements from the palette, editing them, and saving drafts.

**Duration estimate**: 3-4 sessions

**Dependencies**: Phase 2 complete (routes cleared, core DB tables exist)

### 3.1 Types

**New file**: `types/course-builder.ts`

Defines all TypeScript interfaces:
- Element types: `ContentElement`, `FeatureElement`, `MediaElement`, union `CourseElement`
- Enums: `ElementType`, `ElementStatus`, `FeatureVariant`, `MediaType`, `ImageSource`
- `SourceRef` interface (table, id, content_hash)
- `QuizConfig` interface (quiz_mode, question_count, pool_size, passing_score, etc.)
- `Course`, `CourseSection` interfaces (DB shape, camelCase)
- `WizardConfig`, `AssignmentTarget` interfaces
- Builder state: `CourseBuilderState`, `CourseBuilderAction` (discriminated union with ~35 action types)
- AI chat types: `CourseBuilderChatMessage`, `CourseBuilderChatUpdates`
- Context API: `CourseBuilderContextValue`

**New file**: `types/course-player.ts`

Defines player/enrollment types:
- `CourseEnrollment`, `SectionProgress`, `QuizQuestion`, `QuizAttempt`
- `ConversationMessage`, `CourseListItem`

### 3.2 State Management

**New file**: `contexts/CourseBuilderContext.tsx`

Follows the Form Builder's `BuilderContext.tsx` pattern exactly:
- `useReducer(courseBuilderReducer, initialState)`
- Auto-save (3s debounce when `isDirty`)
- Keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+S, Escape)
- Undo/redo (snapshot-based, 30 max history)
- `saveDraftInternal()` with optimistic concurrency

Key difference from Form Builder: elements are nested inside `sections[].elements[]`, not flat `fields[]`. The `activeSectionId` controls which section's elements are visible in the canvas.

### 3.3 Utility Functions

**New file**: `lib/course-builder/builder-utils.ts`

- `generateElementKey(type, existingKeys)` -- unique key per element
- `generateCourseSlug(title)` -- URL-safe slug
- `getDefaultElement(type, variant?)` -- factory for new elements
- `getDefaultQuizConfig()` -- default quiz settings
- `getDefaultSection(title)` -- factory for new sections
- `FEATURE_VARIANTS` -- metadata for all 6 variants (label, color, bgClass, borderClass, icon)

### 3.4 Page Shell

**New files**:
- `pages/admin/AdminCourseBuilderPage.tsx` -- wraps `CourseBuilderProvider` + `DndContext`
- `pages/admin/AdminCourseListPage.tsx` -- list all courses with "Create" button

Desktop layout:
```
TopBar: [<- Back] [Title (editable)] [Save status] [Undo] [Redo] [Save Draft] [Publish]
Left:   ElementPalette + SectionNavigator
Center: CourseBuilderCanvas (element cards with controls)
Right:  AI Panel (stub) / Element Properties Panel
Bottom: Settings | Outline | Content | Quiz | Preview tabs
```

Routes added to `App.tsx`:
```
/admin/courses              -> AdminCourseListPage
/admin/courses/new          -> AdminCourseBuilderPage
/admin/courses/:id/edit     -> AdminCourseBuilderPage
```

### 3.5 Element System Components

| Component | Purpose |
|-----------|---------|
| `ElementPalette.tsx` | Left panel: draggable element types (Content, Feature x6, Media) + section navigator |
| `CourseBuilderCanvas.tsx` | Center panel: `SortableContext` rendering section elements |
| `ElementCardWrapper.tsx` | Per-element wrapper: drag handle, AI button, edit, delete, status badge |
| `ContentElementRenderer.tsx` | Renders content elements: outline state (instructions), generated state (Markdown) |
| `FeatureElementRenderer.tsx` | Renders feature callouts with variant-specific colors/icons |
| `MediaElementRenderer.tsx` | Renders media: image placeholder, YouTube embed, video player |
| `SectionNavigator.tsx` | Section list below palette: click to switch active section |
| `CourseBuilderTopBar.tsx` | Top bar with title, save status, undo/redo, publish |
| `ElementPropertiesPanel.tsx` | Right panel when element is selected: edit properties |

**New hook**: `use-course-builder-dnd.ts` -- handles DnD logic (palette to canvas insert, canvas reorder)

### 3.6 What This Phase Delivers

A fully functional three-column editor where an admin can:
- Add content/feature/media elements from the palette (click or drag)
- Reorder elements via drag-and-drop
- Navigate between sections
- Edit element content inline (direct Markdown editing)
- See all 6 feature variants with proper color coding
- Undo/redo all operations
- Auto-save drafts to database

**No AI yet** -- that comes in Phase 4. But the editor is fully functional for manual authoring.

### Acceptance Criteria

- [ ] 0 TypeScript errors
- [ ] Can create a new course from `/admin/courses`
- [ ] 3-column layout renders correctly at desktop (1280px+) and iPad (768px)
- [ ] All 3 element types render in both outline and generated states
- [ ] All 6 feature variants display correct colors and icons
- [ ] Drag-and-drop reordering works (palette to canvas, canvas reorder)
- [ ] Section navigator shows sections, clicking switches canvas content
- [ ] Undo/redo works (Ctrl+Z, Ctrl+Shift+Z)
- [ ] Auto-save writes to `course_sections.elements` JSONB
- [ ] Save status indicator shows saved/saving/unsaved/error

---

## Phase 4: Menu Rollout Wizard + AI Pipeline + Image Generation

**Goal**: Build the first wizard (Menu Rollout), the `build-course` and `build-course-element` edge functions, and AI image generation (DALL-E). After this phase, an admin can use the Menu Rollout wizard to have AI generate a complete course with content AND educational media.

**Why Menu Rollout first**: This is the most common use case — building training around menu items. It has a constrained source (products only, no manual sections), which makes it a focused proving ground for the entire AI pipeline. Once Menu Rollout is battle-tested, the other wizards (which expand source material types) are straightforward to build.

**Duration estimate**: 4-5 sessions

**Dependencies**: Phase 3 complete (builder core working)

### 4.1 Menu Rollout Wizard

**New components**:

| Component | Purpose |
|-----------|---------|
| `CourseWizardDialog.tsx` | Full-screen dialog: wizard type selector (6 cards). Only "Menu Rollout" is active. Other 5 show "Coming Soon". Each unlocked after battle-testing. |
| `WizardStepLayout.tsx` | Step indicator, content area, Back/Next/Cancel/Build buttons |
| `MenuRolloutWizard.tsx` | 6 steps: Description, Item Selection (products only — no manual sections), AI Instructions, Assessment Type, Assignment, Review & Build. AI creates per-item content with allergen warnings + pairing suggestions. |

**Shared wizard sub-components** (reused by all future wizards):

| Component | Purpose |
|-----------|---------|
| `SourceMaterialPicker.tsx` | Searchable multi-domain picker: Dishes, Wines, Cocktails, Recipes, Beer & Liquor. Menu Rollout uses products only. Future wizards (SOP Review, etc.) add Manual Sections. Uses existing `search_*` RPC functions. |
| `QuizModeSelector.tsx` | Quiz mode radio cards. MVP: only MC is selectable. Voice/Interactive show "Coming Soon". |
| `TeacherLevelSelector.tsx` | 4 radio cards with descriptions (Friendly, Professional, Strict, Expert) |
| `AssignmentPicker.tsx` | Target selector: All Staff / By Role / Individual |

**New hook**: `use-source-material-search.ts` -- calls all relevant search RPCs in parallel, merges and ranks results.

### 4.2 Edge Function: `build-course`

**New file**: `supabase/functions/build-course/index.ts`

Three modes via `step` parameter:

| Step | Input | Output | Credits |
|------|-------|--------|---------|
| `outline` | Wizard config + source material IDs | Course outline (sections + elements, all `status: outline`) | 2 |
| `content` | Course ID (outline must exist) | All elements populated with full content (`status: generated`) | 1 per section |
| `chat_edit` | Course ID + section ID + free-text instruction | Modified elements array | 1 |

**Source Material Assembly Pipeline**:
1. Fetch full sections via `get_full_sections(section_ids)` -- complete, untruncated
2. Fetch full products via SELECT from each product table
3. Compute MD5 hashes for `source_refs` on each element
4. Estimate token count (~0.75 tokens/word English)
5. If >80K tokens, prioritize most relevant sources with a note
6. Pass assembled material to `gpt-4o-mini` with structured JSON output

**Outline generation**: One AI call, `response_format: json_schema`, temperature 0.6, max_tokens 4000. Returns structured sections with element placeholders.

**Content generation**: Sequential per section, per element. Each element gets its own AI call with relevant source material from `source_refs`. Temperature 0.5. Content elements get ~2000 max_tokens, features ~800, media captions ~300.

**Shared utilities**: `supabase/functions/_shared/course-builder.ts` -- source material assembly, element serialization, hash computation.

### 4.3 Edge Function: `build-course-element`

**New file**: `supabase/functions/build-course-element/index.ts`

Regenerates a single element with new or modified instructions. Used by:
- The per-element AI button (inline prompt)
- The AI chat panel (for single-element changes)

### 4.4 AI Integration Components

| Component | Purpose |
|-----------|---------|
| `CourseAIBuilderPanel.tsx` | Right-side chat panel (same pattern as Form Builder's `AIBuilderPanel`). Text + voice input. Quick-start chips. Change cards under assistant messages. |
| `AIProgressOverlay.tsx` | Semi-transparent overlay during "Build All": progress bar, current element title, cancel button |
| `InlineAIPrompt.tsx` | Small popover when clicking AI button on an element: shows instructions, text input, submit |

**New hooks**:
- `use-build-course.ts` -- orchestrates `generateOutline()`, `buildAll()`, `buildElement()`
- `use-course-builder-chat.ts` -- sends messages to `build-course` with `step: chat_edit`

### 4.5 AI Image Generation (DALL-E)

**Included in Phase 4** (not deferred). Courses should not look text-heavy. AI-generated media (educational illustrations, concept diagrams, scenario images) makes courses visually engaging. This is NOT for dish photos — those come from the product DB. The user always decides whether to use AI images.

**New edge function**: `generate-image` with `mode: 'course'`:
- Educational illustrations, concept diagrams, infographics
- Stored in `course-media` bucket at `courses/{course_id}/elements/{element_key}/{timestamp}.png`
- DALL-E 3, 1024x1024, standard quality
- 2 credits per generation
- Fallback: if generation fails, element shows placeholder with caption

**New component**: `MediaElementEditor.tsx` updated with "Generate Image" button (active, not placeholder):
- AI generates image based on element's `ai_instructions` + surrounding content context
- Preview in element card, re-generate or upload own image as alternative
- "Generate images for all Media elements" batch action in AI panel

### 4.6 Integration Flow

```
Admin clicks "Create Course" -> Wizard selector -> "Menu Rollout"
  -> 6 wizard steps (description, item selection, instructions, quiz, assignment, review)
  -> Clicks "Build Course"
  -> build-course(step: 'outline') -> ~5-10 seconds
  -> Canvas shows outline elements (all status: 'outline')
  -> Admin reviews: reorder, delete, edit instructions, add new elements
  -> Clicks "Build All Content"
  -> build-course(step: 'content') -> ~30-60 seconds, progress overlay
  -> Content elements populated, media elements get AI-generated images
  -> All elements now status: 'generated' with full Markdown content + media
  -> Admin can edit inline, use AI chat panel, or use per-element AI button
  -> Clicks "Save Draft" or "Publish"
```

### Acceptance Criteria

- [ ] Menu Rollout wizard completes all 6 steps (product-only source selection)
- [ ] Source Material Picker searches across all 6 product tables
- [ ] `build-course` edge function deployed with `--no-verify-jwt`
- [ ] Outline generation returns valid structured sections + elements
- [ ] Content generation populates all elements with bilingual Markdown
- [ ] AI image generation produces educational illustrations via DALL-E
- [ ] Generated images stored in `course-media` bucket
- [ ] Media elements show "Generate Image" button + upload alternative
- [ ] Per-element AI button regenerates a single element
- [ ] AI chat panel modifies multiple elements from a single instruction
- [ ] Progress overlay shows during "Build All" (element X of Y)
- [ ] Credits consumed correctly (2 for outline, 1 per section for content, 2 per image, 1 per element regen)
- [ ] Error handling: failed elements show retry button, other elements still generated

---

## Phase 5: Quiz Builder + Course Player MVP

**Goal**: Build the MC quiz generation, the Course Player (staff learning UI), and enrollment/progress tracking. After this phase, the training section is FULLY LIVE again -- staff can browse courses, learn, take MC quizzes, and track progress. The stub page is replaced.

**Duration estimate**: 4-5 sessions

**Dependencies**: Phase 4 complete (courses can be created with AI)

### 5.1 DB Migration: Enrollment, Progress, Quiz Tables

**File**: `20260306100500_cb_enrollment_progress.sql`

| Table | Purpose |
|-------|---------|
| `course_enrollments` | User enrollment per course (status, progress counts, final_score, course_version) |
| `section_progress` | Per-section completion (elements_viewed, quiz_score, time_spent, content_hash_at_completion) |
| `program_enrollments` | Program-level enrollment + auto-sync from course completions |
| `course_conversations` | Persistent AI teacher chat history (messages JSONB, session summary, topic tracking) |

**File**: `20260306100600_cb_quiz_tables.sql`

| Table | Purpose |
|-------|---------|
| `quiz_questions` | Question pool (MC + voice + interactive_ai types). Pool management: is_active, is_archived, times_shown, times_correct, auto_flagged. |
| `quiz_attempts` | Quiz session tracking (attempt_number, score, passed, questions_covered) |
| `quiz_attempt_answers` | Individual answer records (selected_option, is_correct, transcription, voice_score) |
| `conversation_messages` | Normalized child table for interactive AI quiz transcripts |

Triggers:
- `set_updated_at()` on all tables (reuses shared function)
- `sync_program_enrollment_on_course_complete()` -- auto-sync trigger on `course_enrollments`
- `auto_flag_quiz_questions()` -- flags questions with >70% miss rate after 10+ shows

RLS: ~45 policies across all tables. Users see own data; managers see group data.

### 5.2 Edge Function: `generate-quiz-pool`

**New file**: `supabase/functions/generate-quiz-pool/index.ts`

Generates a question pool at course build time (not on-the-fly).

- Fetches all section content + original source material
- Calls `gpt-4o-mini` with structured JSON output
- Batches: 15 MC questions per call (stays under 16K output token limit)
- Questions distributed across sections, difficulty: 30% easy, 50% medium, 20% hard
- Bilingual: question_en, question_es, option text_en/es, explanation_en/es
- 3 credits per generation

**MVP**: Only `multiple_choice` type generated. Voice and interactive_ai deferred to Phase 7/8.

### 5.3 Quiz Configuration in Builder

| Component | Purpose |
|-----------|---------|
| `QuizConfigPanel.tsx` | Quiz settings in builder's right panel: mode (MC only for MVP), question count, pool size, passing score, max attempts, cooldown, shuffle toggles |
| `QuestionPoolPreview.tsx` | Shows generated questions with expand/collapse, quality indicators |
| `GenerateQuizButton.tsx` | Triggers `generate-quiz-pool`, shows progress |

**New hook**: `use-quiz-pool.ts` -- fetches questions, supports regenerateQuestion and regenerateAll.

### 5.4 Course Player (Staff Learning UI)

**New pages**:

| Page | Route | Purpose |
|------|-------|---------|
| `CourseHomePage.tsx` | `/courses` | Course catalog: "My Courses" + "All Courses" tabs, search, card grid |
| `CoursePlayerPage.tsx` | `/courses/:courseSlug` | Course overview: description, section list with progress, "Continue Learning" button |
| `CourseSectionPlayerPage.tsx` | `/courses/:courseSlug/:sectionSlug` | Full-screen section player: renders elements sequentially, progress tracking |
| `CourseQuizPlayerPage.tsx` | `/courses/:courseSlug/:sectionSlug/quiz` | MC quiz experience: question -> options -> feedback -> results |

**New player components**:

| Component | Purpose |
|-----------|---------|
| `CourseCard.tsx` | Course card with icon, title, progress bar, estimated time, CTA button |
| `SectionPlayerCard.tsx` | Section card in course overview: title, element count, completion status |
| `PlayerContentRenderer.tsx` | Read-only content element: rendered Markdown |
| `PlayerFeatureRenderer.tsx` | Read-only feature callout: full variant styling |
| `PlayerMediaRenderer.tsx` | Read-only media: image, YouTube iframe, video |
| `TeacherChatPanel.tsx` | AI teacher chat (side panel desktop, sheet mobile). Uses existing `ask` edge function. |
| `MCQuestionCard.tsx` | MC question display with options, immediate/end feedback |
| `QuizResultsCard.tsx` | Results screen: score, pass/fail, competency level, feedback |
| `QuizProgressBar.tsx` | Progress indicator during quiz |

**New hooks**:
- `use-course-catalog.ts` -- fetches courses with enrollment status
- `use-course-enrollment.ts` -- enroll/unenroll, fetch enrollment
- `use-section-player.ts` -- section data + progress, mark elements viewed, complete section
- `use-course-quiz.ts` -- start attempt, submit answer, complete attempt
- `use-teacher-chat.ts` -- AI teacher conversation per section

### 5.5 Navigation Restored

- "Training" link re-added to sidebar navigation, pointing to `/courses`
- The `CourseComingSoonPage.tsx` stub from Phase 2 is deleted
- Staff can now browse and take courses

### 5.6 Management Functions Rebuilt

```sql
-- expire_rollouts() -- placeholder, no rollout tables yet
-- cleanup_expired_training_data() -- handles conversations + transcription expiry
-- get_team_progress() -- basic version using new enrollment tables
```

Cron job `cleanup-training-data` re-scheduled: `0 2 * * *`

### Acceptance Criteria

- [ ] Quiz generation produces valid MC questions (bilingual)
- [ ] Quiz config panel in builder works (mode, count, passing score)
- [ ] Question pool preview shows generated questions
- [ ] Course Player at `/courses` shows course catalog
- [ ] Staff can enroll in published courses
- [ ] Section player renders all 3 element types correctly
- [ ] MC quiz works: answer questions, get score, pass/fail
- [ ] Section progress tracked (elements viewed, quiz score, time spent)
- [ ] Course enrollment progress updates (completed sections / total)
- [ ] Program enrollment auto-sync trigger fires on course completion
- [ ] AI teacher chat works during section learning
- [ ] Training navigation link is live -- no more stub page
- [ ] `generate-quiz-pool` deployed with `--no-verify-jwt`

---

## Phase 6: Stale Detection + Element-Level Rebuild

**Goal**: Implement content change detection so that when source material changes (menu items, manual sections), the system detects staleness at the **element level** and notifies the admin. The admin triggers a surgical rebuild — only the affected elements and their quiz questions, NOT the entire course.

**Duration estimate**: 2-3 sessions

**Dependencies**: Phase 5 complete (courses exist, player works)

### 6.1 Element-Level Rebuild Strategy (Owner Decision on Devil's Advocate Finding #2)

The original plan proposed full course rebuilds. The Devil's Advocate flagged rebuild storms. **Owner decision**: the primary scenario is menu item changes. When a menu item changes:

1. The system identifies which **specific elements** reference that item (via `source_refs`)
2. Only those elements are rebuilt — NOT the entire course
3. Quiz questions for the affected sections are regenerated
4. Everything else in the course stays untouched

**Why this works**: A menu item change (e.g., price update on the Ribeye) only affects the 2-3 elements that specifically reference it. The rest of the course (other dishes, pairings, techniques) is unaffected. This makes rebuilds fast, cheap, and targeted.

**Cost comparison**:
- Full course rebuild: ~$2-5 per course (all elements + all quiz questions)
- Element-level rebuild: ~$0.30-0.50 per change (1-3 elements + section quiz questions)

Admin still triggers manually via notification. Auto-rebuild toggle deferred to Phase 9.

### 6.2 DB Migrations

**File**: `20260306100700_cb_change_tracking.sql`

| Table | Purpose |
|-------|---------|
| `content_change_log` | Source-level change tracker: source_table, source_id, content_hash, previous_hash, affected_elements JSONB (element-level, not just courses) |
| `element_rebuild_log` | Element-level rebuild log: element_key, course_id, section_id, trigger_source, old_hash, new_hash, quiz_questions_regenerated, review_status |

```sql
-- Change detection function (element-level granularity)
CREATE OR REPLACE FUNCTION public.detect_element_changes(p_group_id UUID)
RETURNS TABLE(course_id UUID, course_title TEXT, section_id UUID, element_key TEXT, source_table TEXT, source_id UUID, ...)
-- Walks published courses → sections → elements → source_refs, checks hashes against current content
```

**File**: `20260306100800_cb_change_triggers.sql`

Change detection triggers on all source tables:
```sql
CREATE TRIGGER trg_detect_change_manual_sections
  AFTER UPDATE OF content_en, content_es ON manual_sections
  FOR EACH ROW EXECUTE FUNCTION fn_log_content_change();

-- Same for: foh_plate_specs, plate_specs, prep_recipes, wines, cocktails, beer_liquor_list
```

The trigger function computes MD5 of new content, checks if any course **elements** reference this record with a different hash, and inserts into `content_change_log` with the specific affected elements (not just affected courses).

### 6.3 Edge Function: `rebuild-course-elements`

**New file**: `supabase/functions/rebuild-course-elements/index.ts`

Called by the admin (not automatically). Takes a list of stale elements and:
1. Fetches updated source material for each affected element
2. Re-generates **only the affected elements** using their existing `ai_instructions`
3. Updates `source_refs[].content_hash` with new hash on each rebuilt element
4. Archives old quiz questions for affected sections (`is_active = false`)
5. Regenerates quiz pool for affected sections only
6. Increments course version
7. Creates `element_rebuild_log` entries
8. Returns summary: "Rebuilt 3 elements in 2 sections, regenerated 8 quiz questions"

**Key**: The function does NOT rebuild untouched elements. A course with 20 elements where 2 are stale → only those 2 get rebuilt.

### 6.4 Frontend: Admin Notifications

| Component | Purpose |
|-----------|---------|
| `ContentChangeAlertBanner.tsx` | Full-width alert banner at top of admin interface. Shows: course name, what changed, which specific elements are stale, "Rebuild Affected Elements" / "Review" / "Dismiss" buttons. Persists until dismissed. |
| `ElementRebuildLogPage.tsx` | Table: Date, Course, Element, Source Change, Status. Click to expand with before/after diff. |

**New hooks**:
- `use-content-change-notifications.ts` -- fetches unacknowledged changes, dismiss/rebuild actions
- `use-element-rebuild-log.ts` -- fetches rebuild log entries with filters

**Admin route**: `/admin/courses/changelog` -> `ElementRebuildLogPage`

### Acceptance Criteria

- [ ] Content change triggers fire when manual sections or products are updated
- [ ] `content_change_log` entries created with correct affected_elements JSONB (element-level)
- [ ] Alert banner shows which specific elements are stale and what source record changed
- [ ] "Rebuild Affected Elements" button triggers `rebuild-course-elements` edge function
- [ ] Only stale elements are rebuilt — untouched elements stay as-is
- [ ] Quiz questions regenerated only for affected sections
- [ ] Course version incremented after element rebuild
- [ ] `element_rebuild_log` entries created with per-element rebuild details
- [ ] Rebuild log page shows all rebuild history at element granularity
- [ ] No automatic rebuilds happen -- admin always triggers manually

---

## Phase 7: Manual Migration + Chunking + Voice Quiz

**Goal**: Convert existing manual sections to be course-builder-ready with proper chunks, upgrade AI search with the new chunking system, and add voice quiz mode. This is the first post-MVP enhancement phase.

**Duration estimate**: 4-5 sessions

**Dependencies**: Phase 6 complete, Menu Rollout wizard battle-tested

### 7.1 Manual Section Migration & Cleanup

**Why now**: The Menu Rollout wizard (Phase 4) works with product data. Before we build the SOP Review and other manual-content wizards, the existing 30 manual sections need to be reviewed and structured properly for the Course Builder to consume. This is a content + schema task.

**Tasks**:
1. Audit all 30 manual sections for completeness and structure
2. Ensure each section has proper H2/H3 heading hierarchy (needed for chunking)
3. Verify EN/ES content parity
4. Flag sections that need content rewrites before they can be used as course source material
5. Document which sections map to which future wizards (SOP Review, Steps of Service, etc.)

### 7.2 Section Chunks + Search Upgrade (Devil's Advocate Finding #4 & #5)

**Why now, not earlier**: The Course Builder uses `get_full_sections()` for complete source material -- it never needed chunks. Chunks are a search optimization for the AI Q&A system (`/ask`). Now that the builder is proven with Menu Rollout, we add chunking to prepare for manual-content wizards and improve AI search.

**DB Migration**: `20260306100900_cb_section_chunks.sql`

Creates `section_chunks` table:
- `id`, `section_id` (FK -> manual_sections), `group_id`
- `chunk_index`, `heading`, `content_en`, `content_es`
- `search_vector_en/es` (FTS, auto-populated by trigger)
- `embedding_en/es` (vector(1536), populated by edge function)
- `word_count_en/es` (GENERATED ALWAYS)
- HNSW + GIN indexes, 4 RLS policies

**New search function**: `search_manual_chunks()` -- hybrid RRF on `section_chunks` (FTS + vector). This is a NEW function, NOT a modification of `search_manual_v2`. The old function remains as fallback.

**Auto-chunking trigger**: When `manual_sections.content_en/es` is updated, delete existing chunks for that section, re-run chunking, mark embeddings as needing refresh.

**Chunking algorithm** (`_shared/chunking.ts`):
1. Split at H2 boundaries first
2. If section >800 words, split at H3 boundaries
3. If still >800, split at paragraph boundaries
4. Minimum 300 words per chunk (merge small trailing chunks)
5. Each chunk retains heading context

**Edge function modification**: `embed-sections` gains `mode: 'chunks'` parameter to embed `section_chunks` instead of `manual_sections`.

**Initial chunking**: One-time script processes all 30 populated sections -> ~100-200 chunks.

### 7.3 Voice Quiz Mode

Add `voice_response` quiz type to the Course Player:

| Component | Purpose |
|-----------|---------|
| `VoiceQuestionCard.tsx` | Question display + record button + transcript review + submit |

- Question posed as text
- User records voice answer via `useVoiceRecording` hook
- Whisper transcribes via existing `transcribe` edge function
- AI evaluates transcript against rubric (accuracy, completeness, hospitality tone)
- Score per rubric criterion
- `generate-quiz-pool` updated to generate voice questions when `quiz_mode` includes voice

### Acceptance Criteria

- [ ] All 30 manual sections audited and heading structure verified (H2/H3 hierarchy)
- [ ] Manual sections ready for chunking (EN/ES content parity confirmed)
- [ ] `section_chunks` table created with ~100-200 chunks from existing 30 sections
- [ ] `search_manual_chunks()` returns better results than `search_manual_v2` for Q&A
- [ ] `search_manual_v2` still works (not modified, fallback)
- [ ] Auto-chunking trigger fires when manual sections updated
- [ ] Chunk embeddings generated via `embed-sections` with `mode: 'chunks'`
- [ ] Voice quiz questions generate and play correctly

---

## Phase 8: SOP Review + Steps of Service Wizards + Rollout System + Manager Dashboard

**Goal**: Build the next two wizards (one at a time, battle-test each before moving on), the rollout system, and the manager dashboard. These wizards use manual section content (now properly chunked from Phase 7).

**Wizard Strategy**: Each wizard is built, deployed, and tested with 2-3 real courses before starting the next. If a wizard reveals issues in the shared pipeline, fix before proceeding.

**Duration estimate**: 4-5 sessions

**Dependencies**: Phase 7 complete (manuals converted, chunks ready)

### 8.1 SOP Review Wizard

**New component**: `SOPReviewWizard.tsx`
- Step 1 is topic selection from manual sections (not products). Dual path: browse sections OR describe topic for AI search
- Uses `search_manual_chunks()` for search, `get_full_sections()` for content assembly
- Reuses all shared sub-components from Phase 4 (`SourceMaterialPicker`, `QuizModeSelector`, `TeacherLevelSelector`, `AssignmentPicker`)
- Battle-test: create 2-3 SOP courses, verify content quality, iterate on prompts before moving on

### 8.2 Steps of Service Wizard

**New component**: `StepsOfServiceWizard.tsx`
- Step 1 is role selection + step selection from manual sections
- Defaults to Interactive AI quiz mode (shows credit warning) — falls back to MC if interactive AI not yet available
- Battle-test: create steps-of-service course, verify flow accuracy

### 8.3 Rollout System

**DB Migration**: `20260306101000_cb_rollouts.sql`

| Table | Purpose |
|-------|---------|
| `rollouts` | Training assignment packages: course_ids, starts_at, deadline, expires_at, status |
| `rollout_assignments` | Per-user rollout tracking: status, progress |
| `evaluations` | AI evaluation snapshots: dual feedback (student + manager views) |

**Management functions rebuilt**: `expire_rollouts()`, full `cleanup_expired_training_data()`.

**Cron job**: Re-schedule `cleanup-training-data` with full logic.

### 8.4 Manager Dashboard

| Page/Component | Purpose |
|----------------|---------|
| `ManagerTrainingDashboard.tsx` | Overview stats, team progress table, rollout management, link to change log |
| `DashboardStatsCards.tsx` | Total courses, active enrollments, completion rate, average score |
| `TeamProgressTable.tsx` | Filterable table: Name, Course, Progress, Score, Status, Last Activity |
| `RolloutManager.tsx` | Active rollouts, create new, progress tracking |

**Admin route**: `/admin/training` -> `ManagerTrainingDashboard`

### Acceptance Criteria

- [ ] SOP Review wizard creates courses from manual sections
- [ ] Steps of Service wizard creates role-based courses
- [ ] Each wizard battle-tested with 2-3 real courses before moving on
- [ ] Rollout system works: create rollout, assign users, track progress
- [ ] Manager dashboard shows team stats and progress
- [ ] Rollout deadline notifications work

---

## Phase 9: Remaining Wizards + Interactive AI + Auto-Rebuild + Polish

**Goal**: Build the final three wizards (Line Cook, Custom, Start Blank), add Interactive AI quiz mode (realtime voice), optional auto-rebuild toggle, and final polish (mobile, accessibility, performance).

**Duration estimate**: 4-5 sessions

**Dependencies**: Phase 8 complete (SOP Review + Steps of Service battle-tested)

### 9.1 Remaining Wizards (One at a Time, Battle-Test Each)

| Wizard | Key Difference | Battle-Test |
|--------|---------------|-------------|
| `LineCookWizard.tsx` | Dual focus: operational standards (manual) + dish training (products). Portion detail level toggle. | Create 2 line cook courses, verify BOH content accuracy |
| `CustomCourseWizard.tsx` | Most flexible — accepts any source material combination (manual + products + free text). | Create 3 diverse courses, verify source mixing works |
| `StartBlankWizard.tsx` | No AI generation — empty course with blank sections. User builds everything manually. | Verify blank course creation, manual element adding |

All wizards reuse the shared sub-components from Phase 4 (`SourceMaterialPicker`, `QuizModeSelector`, `TeacherLevelSelector`, `AssignmentPicker`).

### 9.2 Interactive AI Quiz (Realtime Voice)

**Extends** existing `realtime-session` edge function with quiz mode:
- AI conducts real-time voice conversation
- Role-playing scenarios (steps of service, guest complaints, upselling)
- Scenario cards generated by `generate-quiz-pool` with `interactive_ai` type
- Post-session evaluation via `course-evaluate` edge function

| Component | Purpose |
|-----------|---------|
| `InteractiveAISession.tsx` | Realtime voice quiz: connects to WebRTC, shows scenario, evaluation after |
| `CreditWarningDialog.tsx` | Warns about realtime API cost (~5 credits/session) before starting |

### 9.3 Optional Auto-Rebuild (Element-Level)

After the element-level rebuild pipeline has been proven reliable in Phases 6-8, add a configurable toggle:

```sql
ALTER TABLE public.courses ADD COLUMN auto_rebuild BOOLEAN NOT NULL DEFAULT false;
```

When `auto_rebuild = true` on a course:
- Content change triggers call `rebuild-course-elements` automatically (via pg_cron polling, not immediate)
- Batched: wait 5 minutes after last change before triggering (debounce)
- Rate limited: max 1 element rebuild batch per course per hour
- Still element-level only — never rebuilds untouched elements
- Admin still gets notification after automatic rebuild

When `auto_rebuild = false` (default, existing behavior):
- Stale detection + notification only
- Admin clicks "Rebuild Affected Elements" to trigger

### 9.4 Mobile Polish

**Course Builder (Admin)**:
- iPad (768-1024px): 3-column preserved, palette collapses to icons-only
- Phone (<768px): 3 tabs (Canvas / Elements / AI), full-width per tab

**Course Player (Staff)**:
- iPad: content full-width, teacher chat as slide-over
- Phone: content full-width, teacher chat as bottom sheet
- Quiz: full-screen on all sizes

### 9.5 Accessibility

- All interactive elements: proper `aria-label` attributes
- Focus management: Tab/Shift+Tab/Escape for element navigation
- Screen reader announcements: save status, AI progress, quiz results
- Color contrast: feature variant colors meet WCAG AA
- `prefers-reduced-motion` respected for animations

### 9.6 Performance

- Virtualization for courses with 50+ elements per section
- Debounced Markdown rendering during inline editing
- Lazy-load YouTube iframes (intersection observer)
- Image optimization: thumbnails in canvas, full-res in player

### 9.7 Error Handling

- AI generation failure: per-element error state with retry button
- Network error during save: persistent error banner with manual retry
- Stale data: re-fetch on window focus
- Rate limit: queue AI requests, show user-friendly cooldown message

### Acceptance Criteria

- [ ] Line Cook wizard creates BOH-focused courses
- [ ] Custom Course wizard creates courses from mixed source material
- [ ] Start Blank wizard creates empty courses for manual building
- [ ] Each wizard battle-tested with 2-3 real courses
- [ ] Interactive AI quiz connects to WebRTC, AI conducts conversation
- [ ] Credit warning displayed before interactive AI session
- [ ] Post-session evaluation works with transcript
- [ ] Auto-rebuild toggle works: on = automatic element-level with debounce, off = manual only
- [ ] Mobile layouts work at 375px, 768px, 1024px for both builder and player
- [ ] WCAG AA color contrast on all feature variants
- [ ] Screen reader announces save status and AI progress
- [ ] YouTube embeds lazy-load
- [ ] Error states display correctly for all AI operations

---

## Migration File Summary

| # | Filename | Phase | Contents |
|---|----------|-------|----------|
| 1 | `20260306100000_cb_teardown.sql` | 2 | Drop 18 tables, 5 functions, 1 cron job, cleanup prompts |
| 2 | `20260306100100_cb_core_tables.sql` | 2 | `training_programs`, `courses`, `course_sections` + 15 RLS + triggers |
| 3 | `20260306100200_cb_storage_and_prompts.sql` | 2 | `course-media` bucket, 3 AI prompts |
| 4 | `20260306100300_cb_get_full_sections.sql` | 2 | `get_full_sections()` function for source material assembly |
| 5 | `20260306100400_cb_credit_costs.sql` | 2 | 11 credit cost entries for course_builder + course_player domains |
| 6 | `20260306100500_cb_enrollment_progress.sql` | 5 | `course_enrollments`, `section_progress`, `program_enrollments`, `course_conversations` + 25 RLS + auto-sync trigger |
| 7 | `20260306100600_cb_quiz_tables.sql` | 5 | `quiz_questions`, `quiz_attempts`, `quiz_attempt_answers`, `conversation_messages` + 20 RLS + auto-flag trigger |
| 8 | `20260306100700_cb_change_tracking.sql` | 6 | `content_change_log`, `element_rebuild_log` + element-level change detection function |
| 9 | `20260306100800_cb_change_triggers.sql` | 6 | Change detection triggers on all 7 source tables (element-level granularity) |
| 10 | `20260306100900_cb_section_chunks.sql` | 7 | `section_chunks` table + `search_manual_chunks()` + chunking trigger |
| 11 | `20260306101000_cb_rollouts.sql` | 8 | `rollouts`, `rollout_assignments`, `evaluations` + management functions + cron |

**Total**: 11 migrations, ~19 new tables, 1 storage bucket, ~90 RLS policies, ~12 functions

---

## Edge Function Summary

| Function | Phase | Status | Purpose | Credits |
|----------|-------|--------|---------|---------|
| `build-course` | 4 | **NEW** | Outline + content + chat_edit generation | 2 (outline), 1/section (content), 1 (chat) |
| `build-course-element` | 4 | **NEW** | Single element regeneration | 1 |
| `generate-image` | 4 | **NEW** | Educational illustration generation via DALL-E 3 (`mode: 'course'`) | 2 |
| `generate-quiz-pool` | 5 | **NEW** | Pre-generate MC question pool (voice added Phase 7) | 3 |
| `rebuild-course-elements` | 6 | **NEW** | Element-level rebuild of stale elements + quiz regen | 1 per element |
| `embed-sections` | 7 | **MODIFY** | Add `mode: 'chunks'` for section_chunks embeddings | 0 |

Existing functions that stay unchanged: `ask`, `ask-product`, `transcribe`, `realtime-session` (extended in Phase 9), `realtime-voice`, `realtime-search`, `ingest-reviews`, `analyze-review`.

---

## Component Count by Phase

| Phase | New Files | Deleted Files | DB Migrations | Edge Functions |
|-------|-----------|---------------|---------------|----------------|
| 1 (Mockup) | 6 HTML files | 0 | 0 | 0 |
| 2 (Teardown + Foundation) | 2 (stub page + archive script) | 52 (old training) | 5 | 0 |
| 3 (Builder Core) | ~17 (types, context, components, hooks) | 1 (stub page) | 0 | 0 |
| 4 (Menu Rollout + AI + Images) | ~18 (wizard, shared pickers, AI panel, image gen, hooks, edge fns) | 0 | 0 | 3 (build-course, build-course-element, generate-image mod) |
| 5 (Quiz + Player) | ~20 (player pages, components, quiz, hooks, edge fn) | 0 | 2 | 1 (generate-quiz-pool) |
| 6 (Element Rebuild) | ~5 (alert banner, rebuild log page, hooks, edge fn) | 0 | 2 | 1 (rebuild-course-elements) |
| 7 (Manuals + Chunks + Voice Quiz) | ~8 (chunk system, voice quiz, manual audit) | 0 | 1 | 1 (embed-sections modified) |
| 8 (SOP + Steps + Rollouts + Dashboard) | ~12 (2 wizards, rollout system, dashboard) | 0 | 1 | 0 |
| 9 (Remaining Wizards + Interactive AI + Polish) | ~10 (3 wizards, interactive AI, mobile polish) | 0 | 0 | 0 |
| **Total** | **~98 new files** | **~53 removed** | **11** | **6** |

---

## Build Order Recommendation

```
Week 1:  Phase 1 (Mockup) -- 1-2 sessions
         Begin Phase 2 (Teardown) after mockup reviewed
Week 2:  Phase 2 (Foundation) -- 2-3 sessions
         Phase 3 (Builder Core) begins immediately after
Week 3:  Phase 3 (Builder Core) -- 3-4 sessions
Week 4:  Phase 4 (Menu Rollout + AI + Image Gen) -- 4-5 sessions
Week 5:  Phase 5 (Quiz + Player) -- 4-5 sessions
         *** MVP COMPLETE -- training section is live with Menu Rollout wizard ***
Week 6:  Phase 6 (Element-Level Rebuild) -- 2-3 sessions
Week 7:  Phase 7 (Manual Migration + Chunking + Voice Quiz) -- 4-5 sessions
Week 8:  Phase 8 (SOP Review + Steps of Service + Rollouts + Dashboard) -- 4-5 sessions
Week 9:  Phase 9 (Line Cook + Custom + Start Blank + Interactive AI + Polish) -- 4-5 sessions
```

**Total estimated**: 9 weeks / ~30-36 sessions

**Wizard unlock order**: Menu Rollout (Phase 4) → SOP Review (Phase 8) → Steps of Service (Phase 8) → Line Cook (Phase 9) → Custom (Phase 9) → Start Blank (Phase 9). Each battle-tested before the next.

---

## Risk Registry

| Risk | Severity | Mitigation |
|------|----------|------------|
| Teardown breaks existing app functionality | HIGH | Stub UI placed before drops; shared helpers preserved; archive data; test all routes after |
| AI-generated course content is low quality | HIGH | Two-step workflow (outline review before content); per-element AI button for iteration; admin review before publish |
| Token budget exceeded for large courses | MEDIUM | Truncation strategy with priority scoring; warn when >80K tokens; batch quiz generation |
| Element rebuild produces worse content | MEDIUM | Element-level only (surgical, not full course); admin reviews before accepting; original preserved until accepted |
| Quiz questions test irrelevant trivia | MEDIUM | Prompt engineering; question quality monitoring (auto-flag >70% miss rate); admin review |
| Mobile experience is unusable | MEDIUM | Phase 1 mockup validates breakpoints; Phase 9 dedicated mobile polish |
| Edge function cold starts during course build | LOW | Sequential processing (not parallel); progress overlay sets user expectations |
| AI image generation produces poor visuals | LOW | User always has upload alternative; images are supplementary not critical; regenerate button |

---

## What's NOT in This Plan (Explicitly Deferred)

| Feature | Reason | When |
|---------|--------|------|
| Document ingestion (`restaurant_documents`, `document_sections`, `document_chunks`) | No restaurants uploading own manuals yet | Future: when multi-tenant document upload is needed |
| Steps of Service dedicated table | Tags on `manual_sections` sufficient for now | Future: if step ordering/role overrides become complex |
| Course versioning with old-version archive | Simplifies MVP; completions tied to current version | Future: when re-certification workflows are needed |
| AI teacher personas (`ai_teachers` selection in wizard) | Table exists but no custom personas created yet | Future: when restaurants create custom teacher personas |
| Batch rebuild (rebuild ALL stale elements across courses at once) | Per-course element rebuild is sufficient for MVP | Phase 9+: after element-level rebuild is proven |
| Mixed quiz mode (MC + voice in same assessment) | Complexity; start with single mode per quiz | Phase 9+: after both MC and voice modes are solid |

---

## Shared Helper Functions (NEVER Dropped)

These functions serve the entire application and are used by the Course Builder. They must NEVER be dropped during teardown or any migration:

- `public.get_user_group_id()` -- returns the current user's group ID from JWT
- `public.get_user_role()` -- returns the current user's role from JWT
- `public.set_updated_at()` -- trigger function that sets `updated_at = now()` on UPDATE

All new tables in this plan use `set_updated_at()` via trigger. All new RLS policies use `get_user_group_id()` and `get_user_role()`.
