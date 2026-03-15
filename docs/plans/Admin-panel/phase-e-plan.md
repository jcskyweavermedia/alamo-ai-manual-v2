# Phase E Plan: Role-Based Access + Mock Data Wiring

**Date**: 2026-03-14
**Scope**: 6 modules, 26 tasks, 7 milestones
**Status**: COMPLETE (26/26 tasks)

---

## Overview

Phase E completes the admin panel by: (1) adding multi-unit context switching, (2) position-based nav filtering so BOH/FOH staff see relevant content, (3) activating RoleGate on in-page elements, (4) replacing mock data with real database queries, (5) cleaning up CORS wildcards across edge functions, and (6) fixing Phase D leftovers.

**Explicitly deferred:**
- SMS/Twilio integration (requires TCPA legal review)
- Contest/incentive system (no backing tables exist)
- Rewards bank (no backing tables)

---

## Architecture Decisions

### AD1: UnitContext is React-State Only (No GUC Revert)

The security fix in migration `20260315100800` changed `set_active_unit` to transaction-scoped GUC (`set_config(..., true)`). We do NOT revert this. Under Supabase's Supavisor transaction-mode pooling, session-scoped GUCs are unreliable between separate queries.

Instead, `UnitContext` stores `activeGroupId` in React state. All hooks already pass `group_id` as an explicit parameter to RPCs (e.g., `use-training-actions` passes `primaryGroup.groupId`). No GUC call is needed for the React app. The `set_active_unit` RPC remains available for edge function / PG-function-to-PG-function use cases.

### AD2: Department-Level Nav Filtering (Not Position-Level)

Filter nav groups by department (BOH/FOH), not individual position. Position-level filtering would block cross-training (a Host enrolled in Server 101 needs FOH content). The `employees` table already has a `GENERATED ALWAYS AS STORED` department column producing `'FOH'`, `'BOH'`, `'Management'`.

Mapping:
| Nav Group | `departments` | Visible to |
|-----------|--------------|------------|
| BOH | `['BOH']` | BOH staff only |
| FOH | `['FOH']` | FOH staff only |
| Learn | (undefined) | Everyone |
| Forms | (undefined) | Everyone |
| Admin | `adminOnly: true` | Admin only |

Managers/admins see ALL groups regardless. Users without an employee record see ALL groups (safe fallback).

### AD3: Mock Data Replacement Strategy

**Data gap inventory** — fields in `AdminEmployee` type vs. database availability:

| Field | DB Source | Phase E Action |
|-------|-----------|----------------|
| id, name, initials, position, department | `employees` table | Wire to real data |
| hireDate, tenureLabel, isNewHire | `employees.hire_date` + computed | Wire to real data |
| needsAttention, attentionReason | `course_enrollments` status checks | Wire to real data |
| currentCourse, courseProgress, overallProgress | `course_enrollments` + `courses` JOIN | Wire to real data |
| grade, avgScore | `course_enrollments.final_score` | Wire to real data |
| coursesDone | COUNT of completed enrollments | Wire to real data |
| avatarColor | Generate from employee initials hash | Compute client-side |
| learnSpeed, leaderboardRank, leaderboardPoints | No backing data | Show `null` / hide in UI |
| courses[] (with modules, attemptHistory, struggleAreas) | `course_enrollments` + `course_section_progress` | Wire enrollment data; module detail from section_progress where available; attemptHistory/struggleAreas unavailable → show empty |
| aiAnalysis (snapshot, strengths, growthTrajectory, prediction) | No backing table | Show "AI Analysis Coming Soon" placeholder |
| vsCohort | No backing function | Hide section when null |

**Keep as mock**: `MOCK_CONTESTS`, `MOCK_REWARDS`, `MOCK_TIMELINE`, `MOCK_GROWTH_TIERS`, `MOCK_LEADERBOARD`, `MOCK_WEEKLY_UPDATE`

### AD4: CORS Cleanup Scope

Only migrate **browser-facing** edge functions. Exclude webhook/admin-only functions:
- `ingest-reviews` (Apify webhook — no browser caller)
- `embed-sections`, `embed-products` (admin batch jobs)
- `analyze-review` (backend-to-backend, zero frontend imports)

These 4 functions keep `corsHeaders` (wildcard) since browsers never call them.

### AD5: get_recent_insights Reuse

Instead of creating a new `get_current_insights` RPC (which would create naming confusion), modify `use-training-insights.ts` to call the existing `get_recent_insights` RPC which already has severity ordering built in.

---

## Milestones and Tasks

### Milestone 1: UnitContext Provider (M1)

#### [x] E1: Create UnitContext provider + useActiveUnit hook
**Module**: M1
**Dependencies**: None
**Files**:
- NEW: `src/contexts/UnitContext.tsx`
- NEW: `src/hooks/useActiveUnit.ts`
- MODIFY: `src/main.tsx` (wrap with `<UnitProvider>`)

**Acceptance criteria**:
- `UnitProvider` fetches ALL `group_memberships` for user (no LIMIT 1)
- Stores `activeGroupId`, `allMemberships`, `switchUnit()`, `isLoading` in context
- `switchUnit(groupId)` validates membership exists, updates `activeGroupId` in React state
- `useActiveUnit()` reads from context, throws if used outside provider
- For single-unit users (current case), behavior identical to old `useGroupId`
- Provider wrapped inside `AuthProvider` in `main.tsx`
- 0 TypeScript errors

#### [x] E2: Deprecate useGroupId as thin wrapper
**Module**: M1
**Dependencies**: E1
**Files**:
- MODIFY: `src/hooks/useGroupId.ts`

**Acceptance criteria**:
- Internals replaced: calls `useActiveUnit().activeGroupId` instead of making Supabase query
- `@deprecated` JSDoc annotation pointing to `useActiveUnit`
- Return type remains `string | null`
- All 10+ consumers compile without changes
- 0 TypeScript errors

#### [x] E3: Create UnitSwitcher component
**Module**: M1
**Dependencies**: E1
**Parallelizable with**: E2
**Files**:
- NEW: `src/components/layout/UnitSwitcher.tsx`

**Acceptance criteria**:
- Renders nothing when `allMemberships.length <= 1`
- When 2+ memberships: renders dropdown with group names, checkmark on active
- Clicking calls `switchUnit(groupId)` → triggers re-render of all consumers
- Uses shadcn `DropdownMenu` primitives
- 0 TypeScript errors

#### [x] E4: Mount UnitSwitcher in Sidebar
**Module**: M1
**Dependencies**: E3
**Files**:
- MODIFY: `src/components/layout/Sidebar.tsx`

**Acceptance criteria**:
- UnitSwitcher rendered between brand area and nav groups
- Single-unit users see no change
- Collapsed sidebar handles switcher gracefully
- 0 TypeScript errors

---

### Milestone 2: Position-Based Navigation (M2)

#### [x] E5: Create useEmployeeProfile hook
**Module**: M2
**Dependencies**: None
**Parallelizable with**: E1, E2, E3, E4
**Files**:
- NEW: `src/hooks/useEmployeeProfile.ts`

**Acceptance criteria**:
- Queries `employees` WHERE `profile_id = auth.uid()` via `useAuth().user.id`
- Returns `{ position: string | null, department: string | null, employeeId: string | null, isLoading: boolean }`
- Returns nulls if no employee record (safe fallback — user sees all nav)
- Department comparison is case-insensitive (DB stores `'FOH'`, nav-config will use `'FOH'`)
- 0 TypeScript errors

#### [x] E6: Add department filter to nav-config
**Module**: M2
**Dependencies**: None
**Parallelizable with**: E1, E5
**Files**:
- MODIFY: `src/lib/nav-config.ts`

**Acceptance criteria**:
- `NavGroup` gains `departments?: string[]`
- BOH group: `departments: ['BOH']`; FOH group: `departments: ['FOH']`
- Learn/Forms: no departments (everyone sees)
- Admin: keeps `adminOnly: true`
- `getVisibleGroups()` signature: `(groups, isAdmin, isManager?, department?)`
  - `isAdmin` or `isManager` → show all non-adminOnly groups
  - `department` set → filter to groups where `departments` undefined OR includes department
  - `department` null/undefined → show all non-adminOnly (safe fallback)
- Existing callers compile (new params optional)
- 0 TypeScript errors

#### [x] E7: Wire department into Sidebar and MobileTabBar
**Module**: M2
**Dependencies**: E5, E6
**Files**:
- MODIFY: `src/components/layout/Sidebar.tsx`
- MODIFY: `src/components/layout/MobileTabBar.tsx` (if it exists and renders nav items)

**Acceptance criteria**:
- Sidebar calls `useEmployeeProfile()` and passes department to `getVisibleGroups()`
- MobileTabBar applies same filtering
- BOH staff: see BOH + Learn + Forms (not FOH, not Admin)
- FOH staff: see FOH + Learn + Forms (not BOH, not Admin)
- Managers/admins: see everything
- 0 TypeScript errors

---

### Milestone 3: RoleGate Activation (M3)

#### [x] E8: Create PositionGate component
**Module**: M3
**Dependencies**: E5
**Parallelizable with**: E1, E6
**Files**:
- NEW: `src/components/auth/PositionGate.tsx`

**Acceptance criteria**:
- Props: `children`, `allowedDepartments?: string[]`, `allowedPositions?: string[]`, `managerBypass?: boolean` (default true), `fallback?: ReactNode`
- Uses `useEmployeeProfile()` for department/position, `useAuth()` for role
- If `managerBypass && (isManager || isAdmin)` → render children
- If department matches `allowedDepartments` or position matches `allowedPositions` → render children
- Otherwise render fallback (default null)
- 0 TypeScript errors

#### [x] E9: Activate RoleGate on admin-only UI elements
**Module**: M3
**Dependencies**: None (RoleGate already exists)
**Files**:
- MODIFY: `src/components/admin-panel/AdminPanelShell.tsx` (AI Hub tab visibility)
- MODIFY: `src/components/admin-panel/hub/SuggestionItem.tsx` (action buttons)
- MODIFY: `src/components/admin-panel/overlays/QuickActionsCard.tsx` (quick action buttons)

**Acceptance criteria**:
- AI Hub tab in AdminPanelShell gated to `['manager', 'admin']` (managers need to see AI suggestions)
- Suggestion action buttons (Approve/Skip/Nudge) gated to `['manager', 'admin']`
- Quick action buttons (Assign Course, Nudge, Schedule 1:1) gated to `['manager', 'admin']`
- Staff can view employee data but not take management actions
- 0 TypeScript errors

**NOTE**: This task modifies AdminPanelShell.tsx. Task E18 also modifies it. E18 MUST run after E9.

---

### Milestone 4: Mock Data Replacement — Database (M4-DB)

#### [x] E10: Migration — get_admin_employees RPC
**Module**: M4
**Dependencies**: None
**Parallelizable with**: E1-E9, E11, E12
**Files**:
- NEW: `supabase/migrations/YYYYMMDD_create_get_admin_employees.sql`

**Acceptance criteria**:
- `get_admin_employees(p_group_id UUID) RETURNS TABLE(...)` with explicit columns:
  - `id UUID, first_name TEXT, last_name TEXT, position TEXT, department TEXT, hire_date DATE, phone TEXT, email TEXT, status TEXT, profile_id UUID`
  - Computed: `tenure_label TEXT` (Week N / N months / N years), `is_new_hire BOOLEAN` (<30 days), `needs_attention BOOLEAN`, `attention_reason TEXT`
  - From enrollments: `current_course TEXT, course_progress TEXT, overall_progress INT, grade TEXT, avg_score NUMERIC, courses_done TEXT`
- JOINs: `employees LEFT JOIN course_enrollments LEFT JOIN courses`
- SECURITY DEFINER, SET search_path = public
- Manager/admin role check via `group_memberships`
- `echo y | npx supabase db push` succeeds

#### [x] E11: Migration — get_employee_detail RPC
**Module**: M4
**Dependencies**: None
**Parallelizable with**: E1-E9, E10, E12
**Files**:
- NEW: `supabase/migrations/YYYYMMDD_create_get_employee_detail.sql`

**Acceptance criteria**:
- `get_employee_detail(p_employee_id UUID) RETURNS TABLE(...)` with top-level typed columns:
  - Employee info columns (id, name, position, department, hire_date, etc.)
  - `courses JSONB` — array of `{ courseId, courseName, courseIcon, status, score, grade, progressPercent, modulesCompleted, modulesTotal, completedDate, modules[] }`
  - Modules sourced from `course_section_progress` where available
- SECURITY DEFINER, SET search_path = public
- Manager/admin authorization check (verify caller is manager/admin in same group)
- `echo y | npx supabase db push` succeeds

#### [x] E12: Migration — hero stats RPCs (3 functions)
**Module**: M4
**Dependencies**: None
**Parallelizable with**: E1-E9, E10, E11
**Files**:
- NEW: `supabase/migrations/YYYYMMDD_create_hero_stats_functions.sql`

**Acceptance criteria**:
- `get_people_hero_stats(p_group_id UUID)` returns: total_employees, new_hires, needs_attention, fully_trained
- `get_hub_hero_stats(p_group_id UUID)` returns: staff_managed, active_courses, pending_actions
- `get_courses_hero_stats(p_group_id UUID)` returns: total_courses, completion_rate, avg_grade
- All: SECURITY DEFINER, SET search_path = public, manager/admin check
- `echo y | npx supabase db push` succeeds

---

### Milestone 5: Mock Data Replacement — Frontend (M4-FE)

#### [x] E13: Regenerate Supabase TypeScript types
**Module**: M4
**Dependencies**: E10, E11, E12
**Files**:
- MODIFY: `src/integrations/supabase/types.ts`

**Acceptance criteria**:
- Run `npx supabase gen types typescript --project-id nxeorbwqsovybfttemrw > src/integrations/supabase/types.ts`
- Types include Phase D tables (training_actions, notifications, training_insights) AND Phase E RPCs
- 0 TypeScript errors after regeneration

#### [x] E14: Create use-admin-employees hook
**Module**: M4
**Dependencies**: E13
**Parallelizable with**: E15, E16
**Files**:
- NEW: `src/hooks/use-admin-employees.ts`

**Acceptance criteria**:
- Calls `supabase.rpc('get_admin_employees', { p_group_id })` using `useGroupId()` or `useActiveUnit()`
- Returns `{ employees: AdminEmployee[], isLoading, error }`
- Transforms DB response into `AdminEmployee` shape:
  - `name` = `first_name + ' ' + last_name.charAt(0) + '.'`
  - `initials` = first letters of first + last name
  - `avatarColor` = deterministic from initials (hash to tailwind color)
  - `courses` = `[]` (list view doesn't need full course data)
  - `aiAnalysis` = undefined (loaded on-demand in overlay)
- 0 TypeScript errors

#### [x] E15: Create use-admin-hero-stats hook
**Module**: M4
**Dependencies**: E13
**Parallelizable with**: E14, E16
**Files**:
- NEW: `src/hooks/use-admin-hero-stats.ts`

**Acceptance criteria**:
- Exports `usePeopleHeroStats()`, `useHubHeroStats()`, `useCoursesHeroStats()`
- Each calls its RPC and returns `{ stats: HeroBannerStat[], isLoading }`
- Formats labels bilingually using ADMIN_STRINGS
- 0 TypeScript errors

#### [x] E16: Create use-admin-courses hook
**Module**: M4
**Dependencies**: E13
**Parallelizable with**: E14, E15
**Files**:
- NEW: `src/hooks/use-admin-courses.ts`

**Acceptance criteria**:
- Queries `courses` + `course_enrollments` + `employees` for active group
- Returns `{ courses: AdminCourse[], isLoading, error }`
- Each course includes `enrolledEmployees` array with progress data
- 0 TypeScript errors

#### [x] E17: Wire PeopleView to real data
**Module**: M4
**Dependencies**: E14, E15
**Files**:
- MODIFY: `src/components/admin-panel/people/PeopleView.tsx`

**Acceptance criteria**:
- `MOCK_EMPLOYEES` import removed, replaced with `useAdminEmployees()`
- `MOCK_PEOPLE_HERO_STATS` import removed, replaced with `usePeopleHeroStats()`
- Loading skeleton shown while data loads
- Empty state when no employees
- `MOCK_LEADERBOARD`, `MOCK_CONTESTS` remain (no backing tables)
- 0 TypeScript errors

#### [x] E18: Wire AdminPanelShell + AIHubView to real data
**Module**: M4
**Dependencies**: E9, E14, E15 (E9 dependency avoids merge conflict — both modify AdminPanelShell)
**Files**:
- MODIFY: `src/components/admin-panel/AdminPanelShell.tsx`
- MODIFY: `src/components/admin-panel/hub/AIHubView.tsx`

**Acceptance criteria**:
- `MOCK_EMPLOYEES` import removed from AdminPanelShell
- `handleEmployeeClick` changed to on-demand: calls `supabase.rpc('get_employee_detail', { p_employee_id })`, sets overlay with real data
- Loading state while employee detail fetches
- `MOCK_HUB_HERO_STATS` removed from AIHubView, replaced with `useHubHeroStats()`
- `MOCK_CONTESTS`, `MOCK_GROWTH_TIERS`, `MOCK_TIMELINE`, `MOCK_REWARDS` remain
- 0 TypeScript errors

#### [x] E19: Wire CoursesView to real data
**Module**: M4
**Dependencies**: E16, E15
**Files**:
- MODIFY: `src/components/admin-panel/courses/CoursesView.tsx`

**Acceptance criteria**:
- `MOCK_COURSES` import removed, replaced with `useAdminCourses()`
- `MOCK_COURSES_HERO_STATS` removed, replaced with `useCoursesHeroStats()`
- `MOCK_EMPLOYEES.find()` in drilldownData replaced with on-demand `supabase.rpc('get_employee_detail')`
- Loading states for course list, detail panel, and drilldown
- Empty state when no courses
- 0 TypeScript errors

#### [x] E20: Handle empty states in employee overlay
**Module**: M4
**Dependencies**: E18
**Files**:
- MODIFY: `src/components/admin-panel/overlays/EmployeeDetailOverlay.tsx`
- MODIFY: `src/components/admin-panel/overlays/EmployeeAIAnalysisPanel.tsx`
- MODIFY: `src/components/admin-panel/overlays/EmployeeCoursePanel.tsx`
- MODIFY: `src/components/admin-panel/overlays/VsCohortCard.tsx`

**Acceptance criteria**:
- Overlay renders correctly when `employee.courses` is empty (shows "No courses enrolled" state)
- AI Analysis panel shows "Coming Soon" placeholder when `aiAnalysis` is undefined
- VsCohortCard renders nothing or placeholder when `vsCohort` is undefined
- Module detail shows available data from `course_section_progress`; hides attemptHistory/struggleAreas when unavailable
- No crashes on null/undefined fields
- 0 TypeScript errors

---

### Milestone 6: CORS Cleanup (M5)

#### [x] E21: Update cors.ts response helpers for origin passthrough
**Module**: M5
**Dependencies**: None
**Parallelizable with**: all M1-M4 tasks
**Files**:
- MODIFY: `supabase/functions/_shared/cors.ts`

**Acceptance criteria**:
- `jsonResponse(data, status?, origin?)` — uses `getCorsHeaders(origin)` when origin provided, falls back to `corsHeaders` for backward compat
- `errorResponse(error, message?, status?, origin?)` — same pattern
- Add environment-variable support: `const PROD_ORIGIN = Deno.env.get('CORS_ALLOWED_ORIGIN')` added to `ALLOWED_ORIGINS` when defined
- Deprecated `corsHeaders` export kept until all functions migrated
- 0 Deno type errors

#### [x] E22: CORS migration — AI + course functions (browser-facing)
**Module**: M5
**Dependencies**: E21
**Parallelizable with**: E23
**Files**:
- MODIFY: `supabase/functions/ask-product/index.ts`
- MODIFY: `supabase/functions/build-course/index.ts`
- MODIFY: `supabase/functions/build-course-element/index.ts`
- MODIFY: `supabase/functions/course-evaluate/index.ts`
- MODIFY: `supabase/functions/course-tutor/index.ts`
- MODIFY: `supabase/functions/course-quiz-generate/index.ts`
- MODIFY: `supabase/functions/course-assess/index.ts`
- MODIFY: `supabase/functions/tts/index.ts`
- MODIFY: `supabase/functions/transcribe/index.ts`

**Acceptance criteria**:
- Each function: extract `const origin = req.headers.get("Origin")`, use `getCorsHeaders(origin)` for all responses
- CORS preflight handler returns `getCorsHeaders(origin)` instead of `corsHeaders`
- `npx supabase functions deploy --no-verify-jwt` succeeds
- Functions respond correctly from `localhost:8080`

#### [x] E23: CORS migration — realtime + form functions (browser-facing)
**Module**: M5
**Dependencies**: E21
**Parallelizable with**: E22
**Files**:
- MODIFY: `supabase/functions/realtime-voice/index.ts`
- MODIFY: `supabase/functions/realtime-search/index.ts`
- MODIFY: `supabase/functions/realtime-session/index.ts`
- MODIFY: `supabase/functions/ask-form/index.ts`
- MODIFY: `supabase/functions/form-builder-chat/index.ts`
- MODIFY: `supabase/functions/generate-form-template/index.ts`
- MODIFY: `supabase/functions/refine-form-instructions/index.ts`
- MODIFY: `supabase/functions/generate-image/index.ts`
- MODIFY: `supabase/functions/ingest/index.ts`
- MODIFY: `supabase/functions/ingest-file/index.ts`
- MODIFY: `supabase/functions/ingest-vision/index.ts`

**Acceptance criteria**:
- Same pattern as E22
- Deploy succeeds
- Voice, search, form builder, and ingest functions work from `localhost:8080`

**NOTE**: `ingest-reviews`, `analyze-review`, `embed-sections`, `embed-products` are EXCLUDED (webhook/admin-only, no browser callers)

---

### Milestone 7: Phase D Leftovers (M6)

#### [x] E24: Wire use-training-insights to existing RPC
**Module**: M6
**Dependencies**: None
**Parallelizable with**: all other tasks
**Files**:
- MODIFY: `src/hooks/use-training-insights.ts`

**Acceptance criteria**:
- Direct `.from('training_insights').select(...)` replaced with `supabase.rpc('get_recent_insights', { p_group_id })`
- Results now severity-ordered (critical first) — the RPC already has this ordering
- Return type remains `TrainingInsight[]`
- Loading/error states preserved
- 0 TypeScript errors

#### [x] E25: Wire notification type labels to localized strings
**Module**: M6
**Dependencies**: None
**Parallelizable with**: all other tasks
**Files**:
- MODIFY: `src/components/admin-panel/notifications/NotificationItem.tsx` (accept `language` prop, display localized type label)
- MODIFY: `src/components/admin-panel/notifications/NotificationDropdown.tsx` (pass `language` to each NotificationItem)

**Acceptance criteria**:
- NotificationItem receives `language` prop
- Notification type rendered as localized label using EXISTING strings: `t.notificationAssignment`, `t.notificationNudge`, `t.notificationReminder`, `t.notificationAnnouncement`
- Type label appears as small badge/text above or beside the title
- 0 TypeScript errors

#### [x] E26: Security hardening — REVOKE EXECUTE on system RPCs
**Module**: M6
**Dependencies**: E10, E11, E12
**Files**:
- NEW: `supabase/migrations/YYYYMMDD_revoke_execute_phase_e.sql`

**Acceptance criteria**:
- Determine which Phase E functions are user-callable vs system-only:
  - **User-callable** (manager/admin via frontend RPC): `get_admin_employees`, `get_employee_detail`, `get_people_hero_stats`, `get_hub_hero_stats`, `get_courses_hero_stats` — these have internal role checks, keep EXECUTE granted
  - **System-only** (if any created for cron/trigger use): REVOKE EXECUTE from PUBLIC, anon, authenticated
- Re-apply REVOKE EXECUTE on Phase D system functions after any `CREATE OR REPLACE`
- `echo y | npx supabase db push` succeeds

---

## Dependency Graph

```
Independent starting tasks (all parallel):
  E1, E5, E6, E8, E9, E10, E11, E12, E21, E24, E25

After E1:
  E2, E3 (parallel)
  After E3: E4

After E5:
  E7 (also needs E6)

After E5:
  E8

After E10 + E11 + E12:
  E13 → E14, E15, E16 (parallel)
  E26

After E9 + E14 + E15:
  E17, E18 (E18 must wait for E9)

After E16 + E15:
  E19

After E18:
  E20

After E21:
  E22, E23 (parallel)
```

## Critical Path

E10/E11/E12 (migrations) → E13 (types) → E14/E15/E16 (hooks) → E17/E18/E19 (views) → E20 (overlay)

## Parallelization Groups

The following task groups can run simultaneously:
- **Group A**: E1, E5, E6, E8, E9, E10, E11, E12, E21, E24, E25 (all independent)
- **Group B**: E2, E3, E7, E13, E26 (after their deps)
- **Group C**: E4, E14, E15, E16, E22, E23 (after their deps)
- **Group D**: E17, E18, E19 (after their deps)
- **Group E**: E20 (final)

---

## Files Summary

### New Files (10)
- `src/contexts/UnitContext.tsx`
- `src/hooks/useActiveUnit.ts`
- `src/hooks/useEmployeeProfile.ts`
- `src/hooks/use-admin-employees.ts`
- `src/hooks/use-admin-hero-stats.ts`
- `src/hooks/use-admin-courses.ts`
- `src/components/layout/UnitSwitcher.tsx`
- `src/components/auth/PositionGate.tsx`
- `supabase/migrations/` (3-4 migration files)

### Modified Files (~30)
- `src/main.tsx`
- `src/hooks/useGroupId.ts`
- `src/hooks/use-training-insights.ts`
- `src/lib/nav-config.ts`
- `src/integrations/supabase/types.ts`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/MobileTabBar.tsx`
- `src/components/admin-panel/AdminPanelShell.tsx`
- `src/components/admin-panel/people/PeopleView.tsx`
- `src/components/admin-panel/courses/CoursesView.tsx`
- `src/components/admin-panel/hub/AIHubView.tsx`
- `src/components/admin-panel/hub/SuggestionItem.tsx`
- `src/components/admin-panel/overlays/QuickActionsCard.tsx`
- `src/components/admin-panel/overlays/EmployeeDetailOverlay.tsx`
- `src/components/admin-panel/overlays/EmployeeAIAnalysisPanel.tsx`
- `src/components/admin-panel/overlays/EmployeeCoursePanel.tsx`
- `src/components/admin-panel/overlays/VsCohortCard.tsx`
- `src/components/admin-panel/notifications/NotificationItem.tsx`
- `src/components/admin-panel/notifications/NotificationDropdown.tsx`
- `supabase/functions/_shared/cors.ts`
- 20 edge function `index.ts` files (CORS migration)

### Untouched (kept as mock)
- `src/data/mock-admin-panel.ts` — shrinks as mocks are removed but retains contest/reward/timeline/leaderboard/growth mocks
