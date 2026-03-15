# Universal Assessment Framework — Implementation Plan

## Audit Fixes (2026-03-13)

This plan was revised after a technical architect audit and a devil's advocate review. The following fixes were incorporated:

| # | Severity | Fix | Rationale |
|---|----------|-----|-----------|
| 1 | CRITICAL | Expand `sync_program_enrollment` trigger WHEN clause in Migration C to also fire on `final_score` changes | The existing trigger ONLY fires on `completed_sections` changes. Without this, writing `final_score` via the evaluation rollup never cascades to `program_enrollments.overall_score`. |
| 2 | CRITICAL | Define precedence: `assessment_config.passing_competency` supersedes `quiz_config.passing_score` for grading decisions | Two conflicting pass/fail thresholds existed. `passing_score` (numeric, e.g. 70) is now the immediate quiz-attempt feedback threshold. The evaluation's competency level is the actual grade. |
| 3 | CRITICAL | Students never call `course-quiz-generate`. Quiz hook fetches pre-existing questions from `quiz_questions` table only. | `course-quiz-generate` has `verifyManagerRole`. Students cannot generate questions. Questions are pre-generated at publish time. |
| 4 | CRITICAL | Define "section needing assessment" = section with >= 1 active row in `quiz_questions`. Sections with zero active questions are informational. | Without this rule, the auto-generate course evaluation has no way to know which sections to wait for. |
| 5 | HIGH | Decouple course evaluation from section evaluation. Section eval INSERT is one request; course eval is a separate follow-up request from the frontend. | The original "two AI calls in one request" design would push section evaluation latency from 3-8s to 6-20s. |
| 6 | HIGH | MC-only evaluations with deterministic scores skip the AI call entirely. Use template-based feedback. Reserve AI for multi-signal, course-level composite, or manager-requested evaluations. | Saves significant AI credits at scale. MC score + competency mapping is deterministic — no AI needed. |
| 7 | HIGH | Respect `courses.version` + `course_enrollments.course_version`. Auto-generate trigger uses version-appropriate section count. | Enrolled students are frozen on their enrollment version. Publishing a new version with different section count must not break in-flight enrollments. |
| 8 | HIGH | Reorder phases: Phase 1 (DB) -> Phase 2 (Edge Function) -> Phase 4 (Rollup) -> Phase 3 (Student UI). Phase 5 can parallel anything. | Student UI can be deferred. The pipeline (DB -> edge function -> rollup) must work end-to-end before building UI. |
| 9 | MEDIUM | Add nullable `unit_id UUID` column to evaluations (no FK). | Costs nothing now. Avoids a painful ALTER + backfill when multi-unit ships. |
| 10 | MEDIUM | Edge function does NOT write to `section_progress.quiz_score`. The evaluation rollup trigger is the single source of truth. | Eliminates double-write. One code path writes the cached score, not two. |
| 11 | MEDIUM | AI failure recovery: insert a "minimal" evaluation with deterministic score + template feedback. Log failure. Manager can regenerate later. | Prevents a student from being stuck if the AI call fails. Graceful degradation. |
| 12 | MEDIUM | Note that this plan does NOT unblock Master Plan Phase B (dashboard) alone. The dashboard's Enrolled tab groups by position, which requires the `employees` table from Master Plan Phase A. | Prevents incorrect sequencing assumptions. |
| 13 | CRITICAL | Course evaluation is auto-generated SERVER-SIDE in `handleSectionEvaluation` when the last assessed section gets its evaluation. Students NEVER call `course_final`. The `course_final` action remains manager-only (for manual re-evaluation / regeneration). | `handleCourseFinal` requires manager/admin role — students would get 403. Moving generation server-side eliminates the role gate problem entirely. Latency increase (~3-8s) only affects the LAST section quiz, not every one. |
| 14 | HIGH | Add `assessed_section_ids UUID[]` column to `course_enrollments`. Populated at enrollment time with section IDs that have active quiz questions. Used for "all sections assessed?" checks instead of querying current quiz_questions. | Without this, adding sections after enrollment changes the completion criteria for in-flight students. Snapshots the assessment scope at enrollment time. |
| 15 | HIGH | Server-side `groupId` validation: edge function queries `profiles.group_id` instead of trusting the client-provided `groupId` in the request body. | Client-provided `groupId` is unvalidated — a malicious client could send a different group's ID, causing evaluation data to appear in the wrong group's dashboard. |

---

## Context

The training system's grading pipeline is broken at the middle: MC quiz scores are calculated per-section but never roll up to course or program level. The `evaluations` table (which stored AI feedback) was dropped during the Course Builder rebuild and never recreated. The student quiz-taking UI was also deleted — the Course Player renders content only, with no quiz step.

Meanwhile, the Master Implementation Plan requires grades, AI feedback, and competency tracking to power the admin dashboard (Grades tab, AI Feedback tab, KPIs), the AI training manager, and progression logic. Different course types will need different assessment approaches (MC, voice, conversation), but all must produce the same output: a score + AI feedback.

This plan implements the Universal Assessment Framework designed in `docs/plans/Admin-panel/Universal Assessment Framework.md` — making evaluations the central grading entity, with quiz scores as inputs rather than the grade itself.

**Independent of multi-unit architecture.** No dependency on brands/units. However, a nullable `unit_id` is included now to avoid future ALTER + backfill (Audit Fix #9).

**Does NOT unblock Master Plan Phase B (dashboard) alone.** The dashboard's Enrolled tab groups by position, which requires the `employees` table from Master Plan Phase A. This plan provides the *data layer* the dashboard reads from, but the dashboard itself needs both this framework AND the employees table (Audit Fix #12).

**Course evaluation is server-side, not student-initiated.** When the last assessed section receives its evaluation, the edge function auto-generates the course evaluation in the same request. Students never call `course_final` — that action remains manager-only for re-evaluation/regeneration (Audit Fix #13).

**`groupId` is server-validated.** The edge function queries `profiles.group_id` for the authenticated user instead of trusting the client-provided value (Audit Fix #15).

---

## Phase Priority Order

Phases are numbered for reference but should be executed in this priority order (Audit Fix #8):

1. **Phase 1** (DB Foundation) -- must be first
2. **Phase 2** (Edge Function) -- depends on Phase 1
3. **Phase 4** (Rollup Cascade) -- depends on Phase 2, completes the pipeline
4. **Phase 3** (Student Quiz UI) -- can be deferred; depends on Phase 2
5. **Phase 5** (Admin Config UI) -- can parallel anything after Phase 1

The critical path is Phase 1 -> Phase 2 -> Phase 4. This gives a working end-to-end pipeline (DB + edge function + rollup) that can be tested via curl before any UI exists. Phase 3 (student UI) and Phase 5 (admin config UI) can be built whenever convenient.

---

## Phase 1: Database Foundation

4 migrations. No edge function or frontend changes.

### Migration A — `evaluations` table (`20260316100000_create_evaluations_table.sql`)

- Table with: `eval_type` (section/course/program/observation), `eval_source` (mc_quiz/voice/conversation/composite/tutor/manager/rollup)
- Universal output: `score` (0-100), `passed`, `competency_level`, `student_feedback` JSONB, `manager_feedback` JSONB
- Flexible input: `signals` JSONB (stores whatever raw assessment data was available)
- Metadata: `ai_model` (NULL when deterministic/template-based -- Audit Fix #6), `evaluated_by` (NULL=AI or deterministic), `superseded_by` (retry chain), `manager_notes`
- **`unit_id UUID` (nullable, no FK)** -- future-proofing for multi-unit; no units table exists yet, so no FK constraint. Avoids ALTER + backfill later (Audit Fix #9)
- 4 indexes (user+section current, enrollment, group+type, course+type)
- 5 RLS policies (user own SELECT/INSERT, manager group SELECT/INSERT/UPDATE)
- `set_updated_at()` trigger (reuse shared function)

### Migration B — `assessment_config` on courses + `assessed_section_ids` on enrollments (`20260316100100_add_assessment_config.sql`)

- New JSONB column on `courses` (separate from `quiz_config` -- different concern)
- Default: `{ require_passing_evaluation: true, passing_competency: "competent", allow_retry: true, max_retries: null }`
- **New `assessed_section_ids UUID[]` column on `course_enrollments`** (Audit Fix #14): Populated at enrollment time with section IDs that have active quiz questions. Snapshots the assessment scope so adding sections later doesn't change criteria for in-flight students. NULL means "legacy enrollment, use current sections."

**Passing score precedence (Audit Fix #2):**
- `quiz_config.passing_score` (e.g. 70) is the **immediate quiz-attempt threshold**. It determines the pass/fail badge shown to the student right after answering questions. This is quick feedback only.
- `assessment_config.passing_competency` (e.g. "competent" = 60-79 range) is the **actual grade**. It determines whether the student has passed the section/course for progression purposes.
- When evaluations are enabled, `passing_competency` SUPERSEDES `passing_score` for all grading decisions (completion gating, dashboard display, program rollup). A student could score 72% on the quiz (passing `passing_score` of 70) but still be rated "novice" (<60) by the evaluation if engagement signals are poor.

### Migration C — Score rollup trigger (`20260316100200_evaluation_rollup_trigger.sql`)

**`sync_evaluation_scores()` -- SECURITY DEFINER, SET search_path = public:**

On INSERT to evaluations:
- If `eval_type='section'`: updates `section_progress.quiz_score` + `quiz_passed` (cache). This is the ONLY code path that writes these columns (Audit Fix #10).
- If `eval_type='course'`: updates `course_enrollments.final_score` + `final_passed`
- Auto-supersedes older evaluations for same (user, section/course)

**CRITICAL: Expand existing `sync_program_enrollment` trigger (Audit Fix #1):**

The existing `sync_program_enrollment_on_course_complete()` trigger on `course_enrollments` ONLY fires when `completed_sections` changes. It computes `AVG(final_score)` -> `program_enrollments.overall_score`. But the evaluation rollup writes `final_score` without changing `completed_sections`, so the trigger never fires.

This migration MUST ALTER the existing trigger's WHEN clause:

```sql
-- Current (broken for evaluation flow):
-- WHEN (OLD.completed_sections IS DISTINCT FROM NEW.completed_sections)

-- Fixed:
DROP TRIGGER IF EXISTS sync_program_enrollment_on_course_update ON course_enrollments;
CREATE TRIGGER sync_program_enrollment_on_course_update
  AFTER UPDATE ON course_enrollments
  FOR EACH ROW
  WHEN (
    OLD.completed_sections IS DISTINCT FROM NEW.completed_sections
    OR OLD.final_score IS DISTINCT FROM NEW.final_score
  )
  EXECUTE FUNCTION sync_program_enrollment_on_course_complete();
```

Without this fix, `program_enrollments.overall_score` remains NULL even after course evaluations are generated.

### Migration D — AI prompt + credit cost (`20260316100300_seed_evaluation_synthesizer_prompt.sql`)

- `evaluation-synthesizer` prompt in `ai_prompts` (universal -- receives signals, produces score + dual feedback)
- Credit cost entry: `course_player / evaluation / 1 credit`
- **Note**: MC-only deterministic evaluations do NOT consume a credit (Audit Fix #6). The credit cost applies only when the AI is actually called.

**Verify**: SQL queries -- table exists (with `unit_id` column), assessment_config column exists, test INSERT triggers rollup to `section_progress`, test `final_score` change triggers program enrollment update, prompt exists.

---

## Phase 2: Edge Function — Persist Evaluations

Modify `course-evaluate/index.ts`. Deploy with `--no-verify-jwt`.

### 2A: `section_evaluation` action (lines ~494-507, currently commented out)

**Signal collection:**
- Collect MC signals: score, questions_total, questions_correct, difficulty breakdown, attempt_id
- Collect engagement signals: time_spent, elements_viewed, completion_rate (from section_progress)

**Evaluation generation (two paths -- Audit Fix #6):**

**Path A -- MC-only, deterministic (no AI call, no credit cost):**
When the section has ONLY MC signals (no voice, no conversation):
- Score = MC score (direct passthrough)
- Competency level = deterministic mapping: novice (<60), competent (60-79), proficient (80-89), expert (90+)
- `student_feedback` = template-based (e.g., "You answered 8 of 10 questions correctly. Strong areas: [topics of correct answers]. Review: [topics of incorrect answers].")
- `manager_feedback` = template-based (competency gaps from incorrect question topics, risk level from score thresholds)
- `ai_model` = NULL (no AI was used)
- INSERT into `evaluations` with eval_type='section', eval_source='mc_quiz'

**Path B -- Multi-signal or non-MC (AI call, 1 credit):**
When the section has voice + MC, conversation signals, or other multi-signal combinations:
- Call `evaluation-synthesizer` prompt with all available signals
- INSERT into `evaluations` with appropriate eval_source

**AI failure recovery (Audit Fix #11):**
If the AI evaluation call fails (timeout, API error, malformed response):
- Fall back to Path A deterministic scoring using whatever numeric signals are available
- INSERT a "minimal" evaluation with the deterministic score and template feedback
- Set `ai_model = NULL` (indicates no AI was used)
- Log the failure to `ai_usage_log` with error details
- A manager "regenerate evaluation" action can be added later to retry failed AI evaluations

**IMPORTANT -- No double-write (Audit Fix #10):**
The edge function does NOT write to `section_progress.quiz_score` or `quiz_passed` directly. It ONLY inserts into `evaluations`. The `sync_evaluation_scores()` trigger (Migration C) handles updating `section_progress` as the single source of truth.

**IMPORTANT -- Server-side auto-trigger for course evaluation (Audit Fixes #5, #13):**
After inserting the section evaluation, the edge function checks if ALL assessed sections now have evaluations. If yes, it auto-generates the course evaluation IN THE SAME REQUEST. This latency increase (~3-8s for AI call) only affects the student's LAST section quiz — all other section evaluations return immediately. Students NEVER call `course_final` directly.

**IMPORTANT -- Server-side `groupId` validation (Audit Fix #15):**
The edge function queries `profiles.group_id` for `auth.uid()` instead of trusting the client-provided `groupId`. The client value is ignored for data writes. This prevents evaluation data from being inserted into the wrong group.

**Section completion check uses `assessed_section_ids` (Audit Fix #14):**
Query `course_enrollments.assessed_section_ids` (snapshotted at enrollment time) to determine which sections need evaluations. If NULL (legacy enrollment), fall back to querying current `quiz_questions`. This prevents adding sections after enrollment from changing completion criteria.

### 2B: `course_final` action (lines ~640-651, currently commented out)

**Manager-only action.** NOT called by students. Used for:
- Manual re-evaluation / regeneration of course evaluations
- Manager-triggered evaluation when auto-trigger didn't fire (edge case recovery)

Role check remains: requires manager/admin. This is correct because students never call this action (Audit Fix #13).

- Fetch all section evaluations for the enrollment
- **"Section needing assessment" rule (Audit Fix #4):** Uses `assessed_section_ids` from enrollment (Audit Fix #14), falling back to current quiz_questions if NULL.
- Build composite signals from section evaluation scores
- This action ALWAYS calls the AI (composite evaluation across multiple sections is not deterministic)
- INSERT into `evaluations` with eval_type='course', eval_source='rollup'
- This triggers the rollup: `final_score` written -> expanded trigger updates `program_enrollments.overall_score` (Audit Fix #1)

### 2C: Helpers

- `countByDifficulty()` utility for signal collection
- `buildDeterministicFeedback()` -- template-based feedback generator for MC-only evaluations (Audit Fix #6)
- `getSectionsNeedingAssessment(courseId, courseVersion)` -- returns section IDs with >= 1 active quiz question, respecting version (Audit Fixes #4, #7)

**Verify**: Complete an MC quiz via curl/admin -> check `evaluations` row exists (with `ai_model = NULL` for MC-only) -> check `section_progress.quiz_score` updated by trigger (not edge function) -> make separate `course_final` call after all sections -> check `course_enrollments.final_score` -> check `program_enrollments.overall_score` cascaded.

---

## Phase 3: Student Quiz UI (MC-Only, Inline in Course Player)

> **Note**: This phase can be deferred. The pipeline (Phase 1 -> Phase 2 -> Phase 4) works end-to-end without a student UI -- it can be tested via curl. Build this when ready for student-facing functionality.

5 new components + 2 modified files. No new pages -- quiz lives inside the player.

**New files:**

- `src/hooks/use-quiz-player.ts` -- State machine: idle -> loading -> ready -> answering -> grading -> results.
  - **CRITICAL (Audit Fix #3):** This hook ONLY fetches pre-existing questions from the `quiz_questions` table. It NEVER calls `course-quiz-generate`. That function has a `verifyManagerRole` check and is for publish-time generation only. Questions must already exist before a student opens the section.
  - On grading: calls `course-evaluate` with `section_evaluation` action.
  - **No `course_final` call (Audit Fix #13):** The edge function auto-generates the course evaluation server-side when the last section is assessed. The frontend simply receives the section evaluation result. If this was the last section, the response may also include a `course_evaluation` field with the auto-generated course result.
- `src/components/course-player/QuizStep.tsx` -- Container: Start button -> question flow -> results. Renders after section content when quiz questions exist.
- `src/components/course-player/QuizQuestionCard.tsx` -- Single MC question: question text, 4 option buttons, immediate feedback (correct/incorrect + explanation), Next button. Bilingual.
  - The immediate pass/fail shown here uses `quiz_config.passing_score` for quick feedback (Audit Fix #2). This is NOT the final grade.
- `src/components/course-player/QuizResultCard.tsx` -- Score circle, pass/fail badge, competency level, student_feedback (strengths, areas to improve, encouragement), retry/continue buttons.
  - The competency level and pass/fail shown here comes from the evaluation (uses `assessment_config.passing_competency`). This IS the actual grade (Audit Fix #2).

**Modified files:**

- `src/pages/CoursePlayerPage.tsx` -- After content elements, render `<QuizStep>` if section has quiz questions (>= 1 active question in `quiz_questions` -- Audit Fix #4). Sections with zero active questions are informational and show no quiz.
- `src/components/course-player/PlayerBottomToolbar.tsx` -- Add `quizRequired`/`quizPassed` props. Disable Next when quiz required but not passed.
- `src/types/course-player.ts` -- Add `StudentFeedback`, `QuizGradeResult`, `QuizEvaluationResult` interfaces.

**Verify**: Open published course -> scroll to section with quiz -> Start Quiz -> answer questions -> see immediate feedback (using `passing_score`) -> see results with evaluation (using `passing_competency`) -> if last assessed section, course evaluation auto-triggered -> Next Section enabled -> complete course.

---

## Phase 4: Course Completion + Score Rollup Cascade

Hook changes. Wires the full pipeline end-to-end. **This phase should be built immediately after Phase 2, before Phase 3.**

### 4A: Assessment-aware course completion

Modify `src/hooks/use-course-enrollment.ts` -- `completeCourse()`:
- Check `assessment_config.require_passing_evaluation`
- If true, verify `final_passed = true` before setting status='completed'
- If false (informational courses), allow completion without evaluation
- **Version awareness (Audit Fix #7):** Use `course_enrollments.course_version` to determine the section list. Do not count sections added in a newer version.

### 4B: "All sections evaluated" check (server-side only)

This logic lives ONLY in the edge function (Audit Fix #13), not in the frontend:
- **Definition (Audit Fix #4):** Uses `assessed_section_ids` from `course_enrollments` (Audit Fix #14). Falls back to querying current `quiz_questions` if NULL (legacy).
- Count assessed sections vs. sections with a non-superseded evaluation.
- When all match, the edge function auto-generates the course evaluation in the same `section_evaluation` request.

### 4C: Full cascade verification

The complete cascade after Phase 4:
1. Section quiz completed -> section evaluation inserted (Phase 2)
2. Evaluation trigger updates `section_progress.quiz_score` (Migration C)
3. **Edge function detects all sections evaluated -> auto-generates course evaluation server-side (Audit Fix #13)**
4. Course evaluation inserted -> trigger updates `course_enrollments.final_score` (Migration C)
5. Expanded trigger on `course_enrollments` fires on `final_score` change (Audit Fix #1)
6. `program_enrollments.overall_score` updated

**Verify**: Complete ALL quizzes in a course -> last section evaluation auto-triggers course evaluation server-side -> `final_score` populated -> `program_enrollments.overall_score` populated -> course status='completed'. Also test: informational course with no quizzes completes normally. Also test: course with mixed assessed/informational sections only waits for assessed sections.

---

## Phase 5: Assessment Config Admin UI

3 component changes. Can be built in parallel with any phase after Phase 1.

- `src/components/course-builder/AssessmentConfigPanel.tsx` -- Toggle: require evaluation, dropdown: passing competency level, toggle: allow retry, number: max retries. **Include a note explaining the relationship between `passing_score` (immediate quiz feedback) and `passing_competency` (actual grade) -- Audit Fix #2.**
- `src/contexts/CourseBuilderContext.tsx` -- Add `assessmentConfig` state + `SET_ASSESSMENT_CONFIG` action
- `src/components/course-builder/QuizBuilderView.tsx` -- Add AssessmentConfigPanel below QuizConfigPanel
- `src/types/course-builder.ts` -- Add `AssessmentConfig` interface

**Verify**: Open Course Builder -> Quiz tab -> see assessment config -> toggle settings -> save -> reload -> settings preserved.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `assessment_config` vs. merging into `quiz_config` | Separate column | Different concerns -- quiz mechanics vs. evaluation gating. Some courses won't have quizzes but still need assessment config. |
| `passing_score` vs. `passing_competency` | Both, with clear precedence | `passing_score` = immediate quiz feedback (UX). `passing_competency` = actual grade (progression). Evaluation supersedes quiz score for all grading decisions. (Audit Fix #2) |
| Trigger vs. dashboard reads evaluations | Both -- trigger caches to section_progress, dashboard reads evaluations | Keeps existing cascade working (section -> course -> program) while giving dashboard access to rich feedback data. |
| Who writes `section_progress.quiz_score` | Evaluation trigger ONLY | Single source of truth. Edge function inserts into evaluations; trigger propagates. No double-write. (Audit Fix #10) |
| Quiz UI: new pages vs. inline in player | Inline in Course Player | No navigation break. Student scrolls content -> quiz -> results in one flow. Simpler routing. |
| Course evaluation: coupled vs. decoupled from section eval | Server-side auto-trigger on last section eval | Student never calls `course_final` (403 problem). Latency increase only on the LAST section quiz (~3-8s extra). All other section evals return immediately. (Audit Fixes #5, #13) |
| MC-only evaluation: AI vs. deterministic | Deterministic (no AI call) | MC score -> competency mapping is trivial math. Template feedback is sufficient. Saves credits at scale. Reserve AI for multi-signal and composite evaluations. (Audit Fix #6) |
| Student quiz question loading | Fetch from `quiz_questions` table | Students NEVER call `course-quiz-generate` (manager-only). Questions are pre-generated at publish time. (Audit Fix #3) |
| "Section needs assessment" definition | >= 1 active quiz question | Concrete, queryable rule. Sections with zero active questions are informational. (Audit Fix #4) |
| Course evaluation: auto vs. on-demand | Server-side auto-trigger in edge function | Edge function auto-generates when last section is assessed. No frontend involvement. `course_final` remains for manager re-evaluation only. (Audit Fix #13) |
| `assessed_section_ids` snapshot | UUID[] on `course_enrollments` | Frozen at enrollment time. Prevents course republish from changing completion criteria for in-flight students. NULL = legacy, fall back to current quiz_questions. (Audit Fix #14) |
| `groupId` validation | Server-side query, not client trust | Edge function queries `profiles.group_id` for `auth.uid()`. Client-provided value ignored for writes. Prevents cross-group data injection. (Audit Fix #15) |
| Existing completed courses | Grandfathered -- no backfill | Students who already completed courses keep their status. Evaluations apply going forward only. |
| `unit_id` on evaluations | Nullable, no FK, added now | Future-proofing. Costs nothing. Avoids ALTER + backfill when multi-unit ships. (Audit Fix #9) |
| AI failure handling | Fall back to deterministic evaluation | Student is never stuck. Minimal evaluation inserted with template feedback. Manager can regenerate later. (Audit Fix #11) |
| Enrolled student versioning | Frozen on `course_enrollments.course_version` | Republishing a course with new sections does not break in-flight enrollments. (Audit Fix #7) |

---

## Files Summary

### New (9 files)
```
supabase/migrations/20260316100000_create_evaluations_table.sql
supabase/migrations/20260316100100_add_assessment_config.sql
supabase/migrations/20260316100200_evaluation_rollup_trigger.sql
supabase/migrations/20260316100300_seed_evaluation_synthesizer_prompt.sql
src/hooks/use-quiz-player.ts
src/components/course-player/QuizStep.tsx
src/components/course-player/QuizQuestionCard.tsx
src/components/course-player/QuizResultCard.tsx
src/components/course-builder/AssessmentConfigPanel.tsx
```

### Modified (7 files)
```
supabase/functions/course-evaluate/index.ts     — section_evaluation + course_final actions, deterministic MC path, AI failure recovery
src/pages/CoursePlayerPage.tsx                   — integrate QuizStep after content (sections with active quiz questions only)
src/components/course-player/PlayerBottomToolbar.tsx — quiz gate props
src/hooks/use-course-enrollment.ts               — assessment-aware completion (version-aware)
src/types/course-player.ts                       — new interfaces
src/contexts/CourseBuilderContext.tsx             — assessment_config state
src/components/course-builder/QuizBuilderView.tsx — add AssessmentConfigPanel
src/types/course-builder.ts                      — AssessmentConfig type
```

### Reference (patterns to follow)
```
supabase/migrations/20260306100600_cb_quiz_tables.sql          — table + RLS pattern
supabase/migrations/20260306100500_cb_enrollment_progress.sql  — trigger pattern
supabase/migrations/20260213130000_seed_quiz_ai_prompts.sql    — prompt seeding
src/components/course-builder/QuizConfigPanel.tsx               — admin config panel
```

---

## Verification: End-to-End Flow

After all phases (executed in priority order: 1 -> 2 -> 4 -> 3 -> 5):

1. Manager creates a course in Course Builder, configures quiz + assessment settings (Phase 5)
2. Manager generates quiz question pool (existing functionality -- `course-quiz-generate` with manager role)
3. Manager publishes course, bumping `courses.version` (existing functionality)
4. Student enrolls and opens course in Course Player; `course_enrollments.course_version` is frozen AND `assessed_section_ids` is snapshotted (Audit Fixes #7, #14)
5. Student reads section content (existing)
6. At end of section with active quiz questions (Audit Fix #4), QuizStep renders -> student takes MC quiz
7. Quiz hook fetches pre-existing questions from `quiz_questions` -- NEVER calls generate (Audit Fix #3)
8. Each answer graded client-side -> immediate feedback shown using `passing_score` threshold (Audit Fix #2)
9. After all questions: evaluation generated -- **deterministic for MC-only** (no AI call, no credit -- Audit Fix #6), or AI-generated for multi-signal sections
10. If AI call fails, deterministic fallback evaluation inserted with template feedback (Audit Fix #11)
11. Evaluation persisted to `evaluations` table with MC + engagement signals
12. Trigger updates `section_progress.quiz_score` and `quiz_passed` -- trigger is the ONLY writer (Audit Fix #10)
13. Edge function checks server-side: are all assessed sections (per `assessed_section_ids` snapshot -- Audit Fix #14) now evaluated?
14. If yes: edge function auto-generates course evaluation in same request (Audit Fix #13). Student never calls `course_final`.
15. Course-level AI evaluation generated (always AI for composite -- 1 credit). `groupId` validated server-side (Audit Fix #15).
16. `course_enrollments.final_score` and `final_passed` written by trigger
17. Expanded WHEN clause on `course_enrollments` trigger fires on `final_score` change (Audit Fix #1)
18. `program_enrollments.overall_score` updated
19. Dashboard (Phase B of master plan) reads from `evaluations` for Grades + AI Feedback tabs
20. **Note**: Dashboard Enrolled tab grouping by position requires `employees` table from Master Plan Phase A (Audit Fix #12)

---

## What This Leaves for Later (no schema changes needed)

- Voice grading (Phase 7) -> new signal type in signals JSONB, same evaluations table. Multi-signal sections trigger AI evaluation path (Audit Fix #6).
- Conversation assessment -> same pattern
- Manager observations -> new signal type, same table
- Manager "regenerate evaluation" action -> re-run AI for failed/deterministic evaluations (Audit Fix #11)
- Dashboard wiring (Master Plan Phase B) -> reads from evaluations. **Requires `employees` table from Phase A for position-based grouping (Audit Fix #12).**
- AI training manager tools (Master Plan Phase C) -> queries evaluations
- Multi-unit scoping -> populate `unit_id` (already present, nullable -- Audit Fix #9) when brands/units are built. Add FK at that time.
