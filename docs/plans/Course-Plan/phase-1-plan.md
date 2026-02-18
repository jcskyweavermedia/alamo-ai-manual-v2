# Phase 1: Foundation — Detailed Implementation Plan

> Database schema, course seed data, TypeScript types, hooks, pages, navigation.
> **Goal**: Staff can browse courses and sections, see what they need to learn.

---

## Agent Outputs

Three specialist agents produced the following artifacts:

| Agent | Output | Location |
|-------|--------|----------|
| **Database Engineer** | 1,231-line SQL migration (12 tables, 73 RLS policies, 38 indexes, triggers) | `supabase/migrations/20260213000000_create_training_system_phase1.sql` |
| **Content Mapper** | Seed migration (7 courses, 35 sections mapped to existing content) | `supabase/migrations/20260213000000_seed_server_101_courses.sql` |
| **Frontend Architect** | Full TypeScript specs (types, 4 hooks, 3 components, 2 pages, 2 file modifications) | Included below in this document |

---

## Alignment Issues to Resolve During Implementation

The three agents worked independently. These discrepancies MUST be resolved when writing the final code:

### Issue 1: Status Enum Mismatch
- **Schema migration** uses: `CHECK (status IN ('draft', 'active', 'archived'))` with default `'draft'`
- **Master plan / Frontend types** use: `'published' | 'draft' | 'archived'` with queries filtering `status = 'published'`
- **Seed migration** doesn't set status, so courses default to `'draft'`
- **Resolution**: Standardize on `('published', 'draft', 'archived')` with default `'published'`. Update schema migration.

### Issue 2: Missing group_id on course_sections
- **Schema migration**: `course_sections` does NOT have a `group_id` column
- **Seed migration**: Tries to INSERT `group_id` into `course_sections`
- **Frontend hooks**: Don't reference `group_id` on sections (use `course_id` join instead)
- **Resolution**: Add `group_id` column to `course_sections` for multi-tenant consistency (matching all other tables). OR remove from seed and rely on course.group_id join.

### Issue 3: Missing columns on course_sections
- **Schema migration**: Lacks `estimated_minutes` and `status` columns
- **Seed migration**: Tries to INSERT `estimated_minutes` and `status`
- **Frontend types**: Define `estimatedMinutes` on `CourseSection`
- **Resolution**: Add `estimated_minutes INT DEFAULT 5` and `status TEXT DEFAULT 'published'` to course_sections.

### Issue 4: Extra columns on course_sections
- **Schema migration** adds: `ai_prompt_en`, `ai_prompt_es`, `quiz_enabled`, `quiz_question_count`, `quiz_passing_score`
- **Master plan / Frontend types**: Don't reference these
- **Resolution**: Keep them — they're forward-looking for Phase 3 quiz integration. Update frontend types to include them optionally.

### Issue 5: enrollment_id FK on section_progress
- **Schema migration**: Has `enrollment_id UUID NOT NULL REFERENCES course_enrollments(id)`
- **Master plan / Frontend types**: Use `course_id` instead of `enrollment_id`
- **Resolution**: Keep BOTH. Add `course_id` to schema and keep `enrollment_id` for join performance. Frontend hooks insert enrollment_id by looking up the enrollment first.

### Issue 6: Missing group_id on course_enrollments
- **Schema migration**: Lacks `group_id` column
- **Frontend hooks**: Try to INSERT `group_id`
- **Resolution**: Add `group_id UUID REFERENCES groups(id)` for multi-tenant consistency.

### Issue 7: courses.description_en NOT NULL
- **Schema migration**: `description_en TEXT NOT NULL`
- **Seed migration**: Doesn't provide descriptions
- **Resolution**: Change to `description_en TEXT` (nullable) OR add descriptions to seed data.

### Issue 8: passing_score default
- **Schema migration**: Default 80
- **Master plan / Seed data**: Uses 70
- **Resolution**: Change default to 70.

---

## Step-by-Step Implementation Order

### Step 1.1 — Apply Schema Migration (with fixes)

Fix the issues listed above in `20260213000000_create_training_system_phase1.sql` before applying:

1. Change `courses.status` CHECK to `('published', 'draft', 'archived')` with default `'published'`
2. Change `courses.description_en` to nullable (`TEXT` without `NOT NULL`)
3. Change `courses.passing_score` default from 80 to 70
4. Add `group_id`, `estimated_minutes`, and `status` columns to `course_sections`
5. Add `group_id` column to `course_enrollments`
6. Add `course_id` column to `section_progress` (keep `enrollment_id` too)
7. Update RLS policies referencing these columns
8. Update partial index on courses to use `status = 'published'` instead of `'active'`

Then deploy:
```bash
npx supabase db push
```

**Verify:**
- All 12 tables visible in Supabase dashboard
- `mcp__supabase__get_advisors --type security` returns clean
- RLS policies correct (test: staff can't see other staff's conversations)

### Step 1.2 — Apply Seed Migration

The seed file at `20260213000000_seed_server_101_courses.sql` is ready but needs:
- Timestamp must be AFTER the schema migration (rename to `20260213000001_...`)
- Verify all slug lookups resolve (run a dry-run SELECT first)

**Verify:**
```sql
SELECT c.title_en, count(cs.*) FROM courses c JOIN course_sections cs ON cs.course_id = c.id GROUP BY c.title_en ORDER BY c.sort_order;
```
Expected: 7 rows, total 35 sections.

### Step 1.3 — Voice Consent Column

Small migration to add voice consent tracking to profiles:
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voice_consent_version INT DEFAULT 0;
```

### Step 1.4 — TypeScript Types

Create `src/types/training.ts` with all interfaces, raw types, and transform functions.

**Delivered by Frontend Architect agent** — full production code ready.

Key types: `Course`, `CourseWithProgress`, `CourseSection`, `SectionWithProgress`, `CourseEnrollment`, `SectionProgress`, `ConversationMessage`, `QuizQuestion`, `QuizAttempt`, `Evaluation`, `Rollout`

Transform functions: `transformCourse()`, `transformCourseSection()`, `transformEnrollment()`, `transformSectionProgress()`

### Step 1.5 — Data Hooks (4 hooks)

| Hook | Purpose |
|------|---------|
| `use-courses.ts` | Fetch courses + enrollment + progress for current user |
| `use-course-sections.ts` | Fetch sections for a course by slug with progress |
| `use-section-progress.ts` | CRUD for section progress (start, update topics, mark complete) |
| `use-enrollment.ts` | Enrollment lifecycle (enroll, start course, auto-enroll) |

All use `useQuery` from tanstack with 5min staleTime. Mutations use `useCallback` + direct Supabase calls (no useMutation — matching existing codebase pattern).

**Delivered by Frontend Architect agent** — full production code ready.

### Step 1.6 — UI Components (3 components)

| Component | Purpose |
|-----------|---------|
| `ProgressRing.tsx` | SVG circular progress indicator (green/amber/gray) |
| `CourseCard.tsx` | Course card for Training Home grid |
| `SectionListItem.tsx` | Section row for Course Detail |

**Delivered by Frontend Architect agent** — full production code ready.

### Step 1.7 — Pages (2 pages)

| Page | Purpose |
|------|---------|
| `TrainingHome.tsx` | Course listing grid (3-col iPad, 2-col phone) |
| `CourseDetail.tsx` | Section list with progress ring + quiz access |

**Delivered by Frontend Architect agent** — full production code ready.

### Step 1.8 — Navigation Wiring

**`constants.ts`**: Add `{ path: '/training', label: 'Training', icon: 'GraduationCap' }` to both STAFF_NAV_ITEMS and ADMIN_NAV_ITEMS after Steps of Service.

**`App.tsx`**: Add two routes:
```tsx
<Route path="/training" element={<ProtectedRoute><TrainingHome /></ProtectedRoute>} />
<Route path="/training/:courseSlug" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
```

### Step 1.9 — Voice Consent Dialog

`VoiceConsentDialog.tsx` — shadcn Dialog component, explains transcription storage, [I Consent] / [Use Text Only] buttons.

**Delivered by Frontend Architect agent** — full production code ready.

---

## Course Content Mapping (from Content Mapper Agent)

### Summary: 7 Courses, 35 Sections

| # | Course | Sections | Content Source | Items Mapped |
|---|--------|----------|---------------|-------------|
| 1 | Culture & Standards | 5 | manual_sections + custom | 4 manual sections |
| 2 | Entrees & Steaks | 7 | foh_plate_specs + custom | 4 dishes |
| 3 | Appetizers & Sides | 5 | foh_plate_specs + custom | 6 dishes (3 grouped in "Signature Sides") |
| 4 | Wine Program | 7 | wines + custom | 5 wines |
| 5 | Cocktails & Bar | 6 | cocktails + custom | 5 cocktails |
| 6 | Beer & Liquor | 4 | beer_liquor_list + custom | 13 items (grouped into 3 sections) |
| 7 | Desserts & After-Dinner | 3 | foh_plate_specs + custom | 2 desserts |

**Total**: 35 sections, 41 unique content records mapped, 8 custom sections (practice/quiz/service)

### Content Coverage
- foh_plate_specs: 12/12 used (100%)
- wines: 5/5 used (100%)
- cocktails: 5/5 used (100%)
- beer_liquor_list: 13/15 used (87%)
- manual_sections: 4/34 used (12% — remaining available for Server 201)

### Section Type Distribution
- **Learn**: 24 sections (instructional, linked to content)
- **Practice**: 7 sections (voice role-play, custom content)
- **Quiz**: 1 section (culture quiz, custom)
- **Overview**: 0 (could add later)
- **Custom**: 3 additional (mods/allergens, steak temps, wine service basics)

---

## Frontend Code Reference

All code below was produced by the Frontend Architect agent (Opus model) after reading 11 existing codebase files to match patterns exactly.

### File List

| # | File | Lines | Status |
|---|------|-------|--------|
| 1 | `src/types/training.ts` | ~300 | NEW |
| 2 | `src/hooks/use-courses.ts` | ~85 | NEW |
| 3 | `src/hooks/use-course-sections.ts` | ~90 | NEW |
| 4 | `src/hooks/use-section-progress.ts` | ~100 | NEW |
| 5 | `src/hooks/use-enrollment.ts` | ~95 | NEW |
| 6 | `src/components/training/ProgressRing.tsx` | ~60 | NEW |
| 7 | `src/components/training/CourseCard.tsx` | ~80 | NEW |
| 8 | `src/components/training/SectionListItem.tsx` | ~65 | NEW |
| 9 | `src/pages/TrainingHome.tsx` | ~75 | NEW |
| 10 | `src/pages/CourseDetail.tsx` | ~130 | NEW |
| 11 | `src/components/training/VoiceConsentDialog.tsx` | ~55 | NEW |
| 12 | `src/lib/constants.ts` | — | MODIFY (add nav item) |
| 13 | `src/App.tsx` | — | MODIFY (add 2 routes) |

### Pattern Decisions Made
1. **Import aliases**: `@/` paths matching Vite/TS config
2. **Transform pattern**: Raw DB rows (snake_case) → `*Raw` interfaces → `transform*()` functions (matching `auth.ts` pattern)
3. **Data fetching**: `useQuery` from tanstack with `staleTime: 5min`, `gcTime: 10min`, `retry: 2`
4. **Mutations**: `useState` + `useCallback` + direct Supabase calls (no `useMutation` — matching existing codebase)
5. **Styling**: `cn()` from utils, Tailwind utilities, shadcn/ui components
6. **Responsive**: `grid-cols-2 md:grid-cols-3` for courses, `grid-cols-1 md:grid-cols-2` for sections
7. **Bilingual**: All display text checks `language === 'es'` with English fallback

### Full Code

The complete TypeScript code for all 13 files is available in the Frontend Architect agent output. Each file includes:
- Exact imports matching existing codebase paths
- Complete component implementations with props interfaces
- Hook implementations with Supabase queries
- Error/loading/empty state handling
- Responsive layout classes
- Bilingual text support

---

## Verification Checklist

After implementing all steps:

- [ ] 12 new tables visible in Supabase dashboard
- [ ] 7 courses with 35 sections seeded
- [ ] Security advisors clean (no missing RLS)
- [ ] Training nav item appears in sidebar
- [ ] `/training` shows 7 course cards with 0% progress
- [ ] Tapping a card navigates to `/training/:courseSlug`
- [ ] Course detail shows sections with correct titles
- [ ] Progress rings animate correctly (green/amber/gray)
- [ ] iPad: 3-col course grid, 2-col section grid
- [ ] Phone: 2-col course grid, 1-col section grid
- [ ] Voice consent dialog renders correctly
- [ ] 0 TypeScript errors
- [ ] Auto-enrollment works on first course view
