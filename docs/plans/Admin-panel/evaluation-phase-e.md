# Phase E Evaluation: Role-Based Access + Mock Data Wiring

**Date**: 2026-03-14
**Evaluator**: Project Evaluator Agent (Opus 4.6)
**Plan reviewed**: `docs/plans/Admin-panel/phase-e-plan.md` (26 tasks, all marked complete)

---

## Current Status

Phase E is **substantially complete** with **22 of 26 tasks fully delivered** and **4 tasks partially delivered** with gaps. The phase achieved its primary goals: multi-unit context switching, position-based nav filtering, admin panel live data wiring, and security hardening. However, the CORS cleanup (E23) is incomplete, MobileTabBar department filtering (E7) was not applied, and `get_employee_detail` (E11) returns a narrower column set than the frontend mapper expects.

---

## What Is Complete

### Milestone 1: UnitContext Provider (4/4 tasks -- COMPLETE)

| Task | Status | Notes |
|------|--------|-------|
| E1: UnitContext + useActiveUnit | DONE | `src/contexts/UnitContext.tsx` fetches all memberships, stores active in React state. Correct decision per AD1 (no GUC). Provider in `App.tsx` (plan said main.tsx -- App.tsx is correct). |
| E2: Deprecate useGroupId | DONE | `src/hooks/useGroupId.ts` is a thin wrapper with `@deprecated` JSDoc. Returns `activeGroupId` from context. |
| E3: UnitSwitcher component | DONE | `src/components/layout/UnitSwitcher.tsx` renders nothing for single-unit users. Uses shadcn DropdownMenu. Handles collapsed sidebar via Tooltip. |
| E4: Mount UnitSwitcher in Sidebar | DONE | Positioned between brand area and collapse toggle in `Sidebar.tsx`. |

### Milestone 2: Position-Based Navigation (2/3 tasks -- E7 PARTIAL)

| Task | Status | Notes |
|------|--------|-------|
| E5: useEmployeeProfile hook | DONE | Queries `employees` by `profile_id`. Returns `position`, `department`, `employeeId`, `isLoading`. Safe null fallback. |
| E6: Department filter in nav-config | DONE | `NavGroup` has `departments?: string[]`. `getVisibleGroups()` filters correctly: admin/manager see all, BOH/FOH filtered, no-employee fallback shows all. |
| E7: Wire department into Sidebar + MobileTabBar | **PARTIAL** | Sidebar correctly calls `useEmployeeProfile()` and passes department. **MobileTabBar does NOT use department filtering** -- it has hardcoded nav items without any `getVisibleGroups()` call or `useEmployeeProfile()` integration. |

### Milestone 3: RoleGate Activation (2/2 tasks -- COMPLETE)

| Task | Status | Notes |
|------|--------|-------|
| E8: PositionGate component | DONE | `src/components/auth/PositionGate.tsx` supports `allowedDepartments`, `allowedPositions`, `managerBypass`. Case-insensitive comparison. Permissive default when no restrictions or no employee record. |
| E9: RoleGate on admin UI elements | DONE | AI Hub tab filtered in `AdminPanelShell` (lines 62-68). `SuggestionItem` wraps action buttons in `<RoleGate allowedRoles={['manager', 'admin']}>`. `QuickActionsCard` wraps entire card in `RoleGate`. |

### Milestone 4: DB Migrations (3/4 tasks -- E11 PARTIAL)

| Task | Status | Notes |
|------|--------|-------|
| E10: get_admin_employees RPC | DONE | `20260316100100_create_get_admin_employees.sql` -- 162 lines. Computes `tenure_label`, `is_new_hire`, `needs_attention`, `attention_reason`, `current_course`, `course_progress`, `overall_progress`, `grade`, `avg_score`, `courses_done`. Manager/admin auth check. SECURITY DEFINER with search_path. |
| E11: get_employee_detail RPC | **PARTIAL** | `20260316100200_create_get_employee_detail.sql` -- 169 lines. Returns base employee fields + nested `courses` JSONB with modules. **Missing computed fields**: `tenure_label`, `is_new_hire`, `needs_attention`, `attention_reason`, `current_course`, `course_progress`, `overall_progress`, `grade`, `avg_score`, `courses_done`. The `AdminPanelShell` mapper at line 145-163 expects these but they resolve to safe defaults (`'N/A'`, `false`, `0`, `undefined`). |
| E12: Hero stats RPCs (3 functions) | DONE | `20260316100300_create_hero_stats_functions.sql` -- 3 well-structured functions with proper auth checks. |
| E13: Regenerate TypeScript types | DONE | Types include Phase E RPCs. All 5 new functions visible in `types.ts`. |

### Milestone 5: Frontend Wiring (6/7 tasks -- E18 PARTIAL due to E11 data gap)

| Task | Status | Notes |
|------|--------|-------|
| E14: use-admin-employees hook | DONE | Calls `get_admin_employees` RPC. Maps to `AdminEmployee` shape with deterministic avatar colors. |
| E15: use-admin-hero-stats hook | DONE | 3 exported hooks (`usePeopleHeroStats`, `useHubHeroStats`, `useCoursesHeroStats`). Bilingual labels. |
| E16: use-admin-courses hook | DONE | 3-query parallel fetch (courses + enrollments + employees). Assembles `AdminCourse[]` with enrolled employees, progress, grades. 280 lines of well-structured code. |
| E17: Wire PeopleView | DONE | `MOCK_EMPLOYEES` removed. Uses `useAdminEmployees()`. Loading skeleton + empty state. Mock leaderboard/contests kept per plan. |
| E18: Wire AdminPanelShell + AIHubView | **PARTIAL** | AdminPanelShell uses `supabase.rpc('get_employee_detail')` for on-demand loading. Loading skeleton overlay works. However, the overlay will show degraded data for computed fields (tenure, grades, attention) because E11 doesn't return them. AIHubView hero stats correctly wired to `useHubHeroStats()`. |
| E19: Wire CoursesView | DONE | `MOCK_COURSES` removed. Uses `useAdminCourses()`. Loading skeleton + empty state. Course sidebar + detail panel functional. |
| E20: Handle empty states in overlay | DONE | No-courses message shows. AI analysis panel returns "No AI analysis available yet." when `aiAnalysis` is undefined. VsCohortCard only renders when `vsCohort` has data. |

### Milestone 6: CORS Cleanup (2/3 tasks -- E23 INCOMPLETE)

| Task | Status | Notes |
|------|--------|-------|
| E21: cors.ts update | DONE | `getCorsHeaders()` function with origin allowlist. `CORS_ALLOWED_ORIGIN` env var support. Deprecated `corsHeaders` export retained for backward compat. |
| E22: CORS migration -- AI + course functions | DONE | All 9 functions migrated to `getCorsHeaders`: `ask-product`, `build-course`, `build-course-element`, `course-evaluate`, `course-tutor`, `course-quiz-generate`, `course-assess`, `tts`, `transcribe`. |
| E23: CORS migration -- realtime + form functions | **INCOMPLETE** | **7 of 11 browser-facing functions NOT migrated**: `realtime-voice`, `realtime-search`, `realtime-session`, `ask-form`, `form-builder-chat`, `generate-form-template`, `refine-form-instructions`. These still use wildcard `*` CORS (either imported `corsHeaders` or locally defined). Only `generate-image`, `ingest`, `ingest-file`, `ingest-vision` were migrated. |

### Milestone 7: Phase D Leftovers (3/3 tasks -- COMPLETE)

| Task | Status | Notes |
|------|--------|-------|
| E24: Wire use-training-insights to RPC | DONE | Uses `supabase.rpc('get_recent_insights')` with `p_group_id`. Severity-ordered results from the RPC. |
| E25: Notification type labels localized | DONE | `NotificationItem` accepts `language` prop. `getTypeLabel()` maps types to `ADMIN_STRINGS[language]`. Type badge rendered as uppercase tracking-wide label. `NotificationDropdown` passes `language` through. |
| E26: REVOKE EXECUTE on Phase E RPCs | DONE | `20260316100400_revoke_execute_phase_e.sql` -- Revokes from `anon` and `public`. Explicitly grants to `authenticated`. All 5 Phase E functions covered. |

---

## What Is Incomplete

### 1. CORS Migration Gap (E23) -- HIGH priority

**7 browser-facing edge functions still use wildcard CORS.**

| Function | Import | Status |
|----------|--------|--------|
| `realtime-voice` | Local `corsHeaders` with `*` | NOT migrated |
| `realtime-search` | Local `corsHeaders` with `*` | NOT migrated |
| `realtime-session` | Local `corsHeaders` with `*` | NOT migrated |
| `ask-form` | `import { corsHeaders }` from shared | NOT migrated |
| `form-builder-chat` | `import { corsHeaders }` from shared | NOT migrated |
| `generate-form-template` | `import { corsHeaders }` from shared | NOT migrated |
| `refine-form-instructions` | `import { corsHeaders }` from shared | NOT migrated |

The realtime functions have their own local `corsHeaders` definitions (not even using the shared import), which makes the migration more complex since their WebSocket upgrade handling needs special attention.

**Impact**: These functions accept requests from any origin, which is a security gap in production. For localhost development this is functional but it contradicts the Phase E CORS cleanup goal.

### 2. MobileTabBar Department Filtering (E7) -- MEDIUM priority

`MobileTabBar.tsx` (line 30-106) uses hardcoded `adminItems` / `STAFF_NAV_ITEMS` arrays without any department-based filtering. The plan's E7 acceptance criteria state: "MobileTabBar applies same filtering" and "BOH staff: see BOH + Learn + Forms (not FOH, not Admin)". This is not implemented.

**Impact**: On mobile, all staff see all nav items regardless of department. The Sidebar filtering works correctly on desktop. Mobile users are the primary audience for restaurant staff, making this the more critical viewport.

### 3. get_employee_detail Missing Computed Fields (E11) -- MEDIUM priority

The `get_employee_detail` RPC returns only base employee fields (`id`, `first_name`, `last_name`, `position`, `department`, `hire_date`, `phone`, `email`, `employment_status`, `profile_id`) plus `courses` JSONB. It does NOT compute:

- `tenure_label` (Week N / N months / N years)
- `is_new_hire` (boolean)
- `needs_attention` / `attention_reason`
- `current_course` / `course_progress`
- `overall_progress` / `grade` / `avg_score` / `courses_done`

The `AdminPanelShell` mapper (lines 145-163) references all these fields from the RPC response. They default safely to `'N/A'`, `false`, `0`, `undefined` -- no crashes -- but the employee overlay header will display incomplete information.

**Impact**: The overlay header shows "N/A" tenure, no attention badges, no grade, no course progress summary. The course detail *within* the overlay (from `courses` JSONB) works correctly. This primarily affects the overlay's "at a glance" info bar.

### 4. `(supabase.rpc as any)` After Types Regen (E13-E16) -- LOW priority

All 4 new hooks use `(supabase.rpc as any)('function_name', ...)` despite the types file including these functions. This is a code quality issue -- the type assertions bypass compile-time checking of parameter names and return shapes.

**Root cause**: Likely the hooks were written before types regen, or the author was uncertain about the generated type compatibility. The `useEmployeeProfile` hook also uses `(supabase.from as any)('employees')`.

---

## Quality / Risk Assessment

### Architecture Soundness

**UnitContext**: The React-state-only approach (AD1) is the correct decision for Supabase's transaction-mode pooling. The context fetches all memberships and stores `activeGroupId` in state. For single-unit users (current case), behavior is identical. Multi-unit switching will work when needed. The deprecation of `useGroupId` as a wrapper is clean.

**PositionGate vs RoleGate**: The two-gate pattern is sound:
- `RoleGate` = role-based (manager/admin/staff) for access control actions
- `PositionGate` = department/position-based for content visibility

Both have permissive defaults (no employee record = see everything), which is the right call for a restaurant app where not all app users may have employee records immediately.

**Nav filtering**: `getVisibleGroups()` is well-implemented. The department → nav group mapping (AD2) is pragmatic -- position-level filtering would break cross-training scenarios.

### Data Flow

**PeopleView**: Fully wired. `useAdminEmployees` -> `get_admin_employees` RPC (computes all fields) -> `AdminEmployee` mapping -> card components. Clean data pipeline.

**CoursesView**: Impressive. 3-parallel-query pattern in `useAdminCourses` (courses + enrollments + employees) with client-side assembly. Handles employee-not-found gracefully. Stuck detection (enrolled >14d, 0 progress).

**AIHubView**: Hybrid approach -- hero stats from RPC, suggestions from `useTrainingActions` (Phase D), mock data for contests/growth/rewards/timeline. This matches the plan's intent.

**Employee Overlay**: On-demand loading via `handleEmployeeClick` -> `get_employee_detail` RPC. Loading skeleton renders correctly. The data gap (missing computed fields) is a functional issue, not a crash risk.

### Code Patterns

**Consistent patterns across hooks**:
- All use `useGroupId()` (which delegates to `useActiveUnit()`)
- All handle loading/error states
- All null-guard before RPC calls when `groupId` is null

**Duplicated code**:
- `AVATAR_COLORS` array and `getAvatarColor()` function appear in both `use-admin-employees.ts` and `use-admin-courses.ts`. Should be extracted to a shared utility.
- The avatar color hashing in `AdminPanelShell.tsx` (lines 115-121) is a third copy with a slightly different array (8 colors vs 10).

**Security**:
- All 5 Phase E RPC functions are SECURITY DEFINER with `SET search_path = public`
- All have manager/admin authorization checks via `group_memberships`
- REVOKE EXECUTE applied for `anon` and `public` roles
- Authenticated role explicitly granted

### Remaining Mock Data

Mock data correctly retained for features without backing tables:
- `MOCK_LEADERBOARD` (no leaderboard system)
- `MOCK_CONTESTS` (no contest tables)
- `MOCK_GROWTH_TIERS` (no growth path system)
- `MOCK_TIMELINE` (no timeline system)
- `MOCK_REWARDS` (no rewards bank)
- `MOCK_WEEKLY_UPDATE` (no weekly summary generator)

`MOCK_EMPLOYEES`, `MOCK_COURSES`, `MOCK_PEOPLE_HERO_STATS`, `MOCK_COURSES_HERO_STATS`, `MOCK_HUB_HERO_STATS` are still exported from `mock-admin-panel.ts` but no longer imported by any view component. They should be cleaned up (dead exports) but this is cosmetic.

---

## Migration Files Audit

All 4 Phase E migration files present on disk:

| File | Size | Content |
|------|------|---------|
| `20260316100100_create_get_admin_employees.sql` | 165 lines | `get_admin_employees(UUID)` with CTEs for enrollment aggregation |
| `20260316100200_create_get_employee_detail.sql` | 169 lines | `get_employee_detail(UUID)` with JSONB courses + modules |
| `20260316100300_create_hero_stats_functions.sql` | 195 lines | 3 hero stat functions |
| `20260316100400_revoke_execute_phase_e.sql` | 23 lines | REVOKE/GRANT for all 5 functions |

All migration files are in the main `supabase/migrations/` directory (not just in worktrees).

---

## Risk Summary

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| CORS wildcard on 7 browser-facing functions | Medium | Security gap in production (any origin can call these) | Complete E23 migration before production deploy |
| MobileTabBar shows all nav to all departments | Medium | BOH staff sees FOH content on mobile (primary viewport) | Wire `useEmployeeProfile` + `getVisibleGroups` into MobileTabBar |
| Employee overlay shows hollow computed fields | Low | "N/A" tenure, no grades in overlay header -- cosmetic data gap | Add computed columns to `get_employee_detail` or compute client-side |
| `as any` RPC calls bypass type checking | Low | Potential runtime type mismatches not caught at compile time | Remove `as any` casts, use generated types |
| Dead mock exports in mock-admin-panel.ts | Very Low | Unused code, no runtime impact | Remove unreferenced exports |

---

## Recommended Next Stage

### Before Continuing to Next Phase

Complete the 4 partial tasks (estimated 2-3 hours):

1. **E23 CORS**: Migrate the remaining 7 browser-facing functions to `getCorsHeaders()`. The realtime functions need special attention since they define their own local `corsHeaders` rather than importing from shared.

2. **E7 MobileTabBar**: Integrate `useEmployeeProfile()` and `getVisibleGroups()` (or a mobile-specific filter) into `MobileTabBar.tsx`. The current hardcoded approach defeats the department filtering on the primary mobile viewport.

3. **E11 get_employee_detail**: Add the same computed columns from `get_admin_employees` (tenure_label, is_new_hire, needs_attention, etc.) to `get_employee_detail`. This can reuse the same CTE patterns. Alternatively, compute these client-side in the AdminPanelShell mapper using `hire_date` and the `courses` JSONB.

4. **Code quality** (optional, can batch later): Extract shared `getAvatarColor()` utility. Remove `as any` RPC casts.

---

## Decision

**CONTINUE IMPLEMENTATION** -- with the 3 high/medium items above addressed first.

Phase E's core architecture is sound, the data pipeline is working, and the pattern is consistent. The gaps are confined to: (a) incomplete CORS migration for a specific set of functions, (b) missing mobile viewport filtering, and (c) a narrower-than-expected RPC return set for one function. None of these are architectural issues -- they are completion gaps that can be resolved in a focused cleanup pass before moving to the next phase.

---

## Reasoning

1. **Architecture is correct**: UnitContext as React-state-only (AD1), department-level nav filtering (AD2), and the two-gate pattern (RoleGate + PositionGate) are all well-designed and correctly implemented.

2. **Core functionality works**: The admin panel renders real data from the database. Hero stats, employee lists, course enrollment data, and employee detail overlay all function with live RPC calls. Mock data is correctly retained only for features without backing tables.

3. **Security is solid**: All RPCs are SECURITY DEFINER with search_path set, all have manager/admin auth checks, REVOKE EXECUTE applied. The only security concern is the incomplete CORS migration.

4. **The gaps are bounded**: All 4 issues are well-defined, isolated, and can be completed without rearchitecting anything. The CORS migration is mechanical (same pattern as E22). The MobileTabBar fix is straightforward (add the same hook call that Sidebar uses). The RPC enhancement adds columns to an existing function.

5. **Not returning to planning or architecture**: The plan is sound. The implementation follows the plan correctly in 22 of 26 tasks. The 4 partial tasks need completion, not redesign.
