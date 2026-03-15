# Security Review -- Admin Panel Phase E

**Date**: 2026-03-14
**Reviewer**: Security Reviewer Agent (Claude Opus 4.6)
**Scope**: Phase E implementation -- Admin Panel multi-unit switching, position-based gating, admin data hooks, CORS cleanup, REVOKE EXECUTE, and new RPC functions.

---

## Security Review Scope

### Files Reviewed

**Frontend (React/TypeScript)**
- `src/contexts/UnitContext.tsx` -- Multi-unit context provider
- `src/hooks/useActiveUnit.ts` -- Active unit hook (re-export)
- `src/hooks/useGroupId.ts` -- Backward-compat wrapper for activeGroupId
- `src/components/layout/UnitSwitcher.tsx` -- Unit switching dropdown
- `src/components/auth/PositionGate.tsx` -- Department/position gating
- `src/components/auth/RoleGate.tsx` -- Role-based gating (existing)
- `src/components/auth/ProtectedRoute.tsx` -- Route-level auth guard
- `src/components/auth/AuthProvider.tsx` -- Auth state management
- `src/hooks/use-admin-employees.ts` -- Admin employees RPC hook
- `src/hooks/use-admin-hero-stats.ts` -- Hero stats RPC hooks (3 functions)
- `src/hooks/use-admin-courses.ts` -- Courses data hook (direct table queries)
- `src/hooks/use-ask-training-manager.ts` -- AI chat hook
- `src/hooks/use-training-actions.ts` -- Training actions hook
- `src/hooks/useEmployeeProfile.ts` -- Employee profile lookup
- `src/components/admin-panel/AdminPanelShell.tsx` -- 3-tab admin shell
- `src/components/admin-panel/people/PeopleView.tsx` -- People tab
- `src/components/admin-panel/courses/CoursesView.tsx` -- Courses tab
- `src/components/admin-panel/hub/AIHubView.tsx` -- AI Hub tab
- `src/components/admin-panel/overlays/EmployeeDetailOverlay.tsx` -- Employee overlay
- `src/components/admin-panel/overlays/WeeklyUpdateOverlay.tsx` -- Weekly update (XSS check)
- `src/pages/admin/AdminTrainingDashboardPage.tsx` -- Top-level page
- `src/App.tsx` -- Route definitions

**Backend (PostgreSQL / Supabase)**
- `supabase/migrations/20260316100100_create_get_admin_employees.sql` -- `get_admin_employees()` RPC
- `supabase/migrations/20260316100200_create_get_employee_detail.sql` -- `get_employee_detail()` RPC
- `supabase/migrations/20260316100300_create_hero_stats_functions.sql` -- 3 hero stats RPCs
- `supabase/migrations/20260316100400_revoke_execute_phase_e.sql` -- REVOKE from anon/public

**Edge Functions**
- `supabase/functions/_shared/cors.ts` -- Shared CORS module (getCorsHeaders + deprecated corsHeaders)
- All 20+ edge functions checked for CORS wildcard usage

---

## Findings

### CRITICAL

*No CRITICAL findings.*

---

### HIGH

#### H1. `get_employee_detail()` -- Enrollment query missing group_id scope (Cross-tenant data leak)

**File**: `supabase/migrations/20260316100200_create_get_employee_detail.sql`, lines 81-83

**Description**: The `get_employee_detail()` function correctly validates that the calling user is a manager/admin in the employee's group (line 55-63). However, the enrollment query on line 81-83 fetches ALL enrollments for the employee by `user_id` without filtering by `group_id`:

```sql
FROM public.course_enrollments ce
JOIN public.courses c ON c.id = ce.course_id
WHERE ce.user_id = v_profile_id   -- <-- missing: AND ce.group_id = v_group_id
```

**Impact**: If an employee is shared across multiple groups (which the multi-unit system in Phase E now enables), a manager in Group A calling `get_employee_detail()` would see the employee's enrollment data from Group B as well. This leaks course progress, quiz scores, and completion dates across tenant boundaries.

**Severity rationale**: The authorization check prevents unauthorized callers, so this requires a legitimate manager account. However, in a multi-tenant system, cross-group data leakage is a significant access control violation.

**Fix**: Add `AND ce.group_id = v_group_id` to the enrollment query:

```sql
WHERE ce.user_id = v_profile_id
  AND ce.group_id = v_group_id
```

---

#### H2. Deprecated wildcard `corsHeaders` still actively imported by 6 browser-facing edge functions

**Files**:
- `supabase/functions/ask-form/index.ts` (line 18)
- `supabase/functions/form-builder-chat/index.ts` (line 12)
- `supabase/functions/generate-form-template/index.ts` (line 12)
- `supabase/functions/refine-form-instructions/index.ts` (line 13)
- `supabase/functions/analyze-review/index.ts` (line 18)
- `supabase/functions/ingest-reviews/index.ts` (line 15)

Additionally, these functions define their own local wildcard `corsHeaders`:
- `supabase/functions/realtime-search/index.ts` (line 10-13)
- `supabase/functions/realtime-session/index.ts` (line 12-15)
- `supabase/functions/realtime-voice/index.ts` (line 16-19)
- `supabase/functions/embed-sections/index.ts` (line 10-13)
- `supabase/functions/embed-products/index.ts` (line 14-18)

**Description**: Phase E's CORS cleanup introduced `getCorsHeaders()` with origin allowlisting in `_shared/cors.ts`, but the deprecated `corsHeaders` export (which uses `Access-Control-Allow-Origin: *`) remains in the module and is actively imported by 6 edge functions. The `jsonResponse()` and `errorResponse()` helpers also default to the wildcard `corsHeaders` when no explicit headers are passed (line 48 of `cors.ts`). Additionally, 5 edge functions define their own local wildcard `corsHeaders` objects, bypassing the shared module entirely.

**Impact**: Any browser on any domain can make authenticated requests to these functions, which could facilitate CSRF-style attacks or data exfiltration if an attacker can trick a user into visiting a malicious page while authenticated.

**Severity rationale**: The functions do verify auth tokens internally, which limits the blast radius. However, the CORS wildcard means malicious origins can read response bodies, which is the core protection CORS is designed to provide.

**Fix**:
1. Migrate all 11 affected edge functions to use `getCorsHeaders(req.headers.get("Origin"))`.
2. Change the `jsonResponse`/`errorResponse` default to NOT use the wildcard -- require an explicit `headers` parameter or make it mandatory.
3. Remove the deprecated `corsHeaders` export to prevent future regression.

---

### MEDIUM

#### M1. `PositionGate` is client-side only with permissive fallback for missing employee records

**File**: `src/components/auth/PositionGate.tsx`, lines 50-57

**Description**: The `PositionGate` component has two permissive default behaviors:

1. **No restrictions specified** (lines 49-52): If neither `allowedDepartments` nor `allowedPositions` is provided, the gate renders children unconditionally.
2. **No employee record** (lines 54-57): If the user has no employee record (no `department` AND no `position`), children are rendered regardless of the department/position restrictions.

Both behaviors are explicitly commented as intentional design choices. However, this means that any authenticated user without a linked employee record (e.g., newly created auth accounts, external users) will bypass all position-based restrictions.

**Impact**: Position-based UI restrictions can be bypassed by any authenticated user who does not have an employee record. The admin RPC functions have their own server-side role checks, so this is a UI bypass only.

**Severity rationale**: Client-side gating is a UX convenience, not a security boundary. The real controls are the server-side role checks in the RPC functions. However, the permissive fallback on missing employee records could expose admin UI to users who shouldn't see it.

**Fix**: Consider changing the no-employee-record fallback (line 55-57) to render `fallback` instead of `children` when department/position restrictions ARE specified. This follows the principle of deny-by-default:

```tsx
// No employee record AND restrictions are specified → deny
if (!department && !position) {
  return <>{fallback}</>;
}
```

---

#### M2. `jsonResponse`/`errorResponse` default to wildcard CORS headers

**File**: `supabase/functions/_shared/cors.ts`, lines 45-50

**Description**: The `jsonResponse` helper defaults to `corsHeaders` (wildcard) when no explicit `headers` parameter is passed:

```typescript
export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(headers ?? corsHeaders), "Content-Type": "application/json" },
  });
}
```

This means every call to `jsonResponse(data)` or `errorResponse(error)` without explicit headers silently uses `Access-Control-Allow-Origin: *`. Functions that import the new `getCorsHeaders` but forget to pass the result to these helpers will still produce wildcard responses.

**Fix**: Change the default to require explicit headers or fall back to `getCorsHeaders(null)` (which returns `http://localhost:8080` instead of `*`):

```typescript
headers: { ...(headers ?? getCorsHeaders(null)), "Content-Type": "application/json" },
```

---

#### M3. Admin Panel page has no route in App.tsx

**File**: `src/App.tsx` (no route for `/admin/training`)
**Related**: `src/pages/Admin.tsx` (line 56 -- navigates to `/admin/training`)
**Related**: `src/pages/admin/AdminTrainingDashboardPage.tsx` (exists but unrouted)

**Description**: The Admin page contains a "Training Dashboard" card that navigates to `/admin/training`, but there is no matching `<Route>` in `App.tsx`. The `AdminTrainingDashboardPage` component exists and is fully implemented but is not wired into the router. Users clicking this card will hit the `*` catch-all route and see the NotFound page.

**Impact**: This is not a security vulnerability but a functionality gap. The admin panel is currently inaccessible through normal navigation. However, from a security perspective, it means the `ProtectedRoute` wrapper with role requirements is also missing, so when the route IS added, it must include `requiredRole={['manager', 'admin']}`.

**Fix**: Add the route to `App.tsx`:

```tsx
<Route path="/admin/training" element={
  <ProtectedRoute requiredRole={['manager', 'admin']}>
    <Suspense fallback={<div>Loading...</div>}>
      <AdminTrainingDashboardPage />
    </Suspense>
  </ProtectedRoute>
} />
```

---

#### M4. RPC functions return PII (phone, email) not consumed by the frontend

**Files**:
- `supabase/migrations/20260316100100_create_get_admin_employees.sql` (lines 20-21, 101-102)
- `supabase/migrations/20260316100200_create_get_employee_detail.sql` (lines 20-21, 161-162)

**Description**: Both `get_admin_employees()` and `get_employee_detail()` return employee `phone` and `email` columns. However, the frontend hooks (`use-admin-employees.ts`, `AdminPanelShell.tsx` line 92) do not map or display these fields. The `AdminEmployee` TypeScript type does not include `phone` or `email`.

**Impact**: The data is transmitted over the wire and visible in browser DevTools network tab, even though it is not displayed in the UI. This is unnecessary PII exposure. An attacker who gains access to the Supabase JWT (e.g., via XSS) can call these RPCs directly and harvest employee contact information.

**Severity rationale**: The RPCs already require manager/admin role in the group, limiting the audience. But returning unnecessary PII violates the data minimization principle.

**Fix**: Remove `phone` and `email` from both RPCs' `RETURNS TABLE` definitions and `SELECT` lists. If these fields are needed for a future feature, add them at that time.

---

#### M5. `CORS_ALLOWED_ORIGIN` environment variable not set in Supabase secrets

**File**: `supabase/functions/_shared/cors.ts`, line 14

**Description**: The `getCorsHeaders()` function reads `CORS_ALLOWED_ORIGIN` from environment variables to add a production origin to the allowlist. However, based on the documented Supabase secrets (in MEMORY.md), this variable has not been set. When the app is deployed to production, `getCorsHeaders()` will only allow `localhost` origins, causing CORS failures for the production domain.

**Impact**: In production, all edge functions using `getCorsHeaders()` will reject requests from the production domain (CORS preflight will fail). This will break the app. The fallback behavior (returning `http://localhost:8080` for non-matching origins) means production browsers will get a mismatched `Access-Control-Allow-Origin` header, causing the browser to block the response.

**Fix**: Set the production origin as a Supabase secret:

```bash
npx supabase secrets set CORS_ALLOWED_ORIGIN=https://your-production-domain.com
```

---

#### M6. `useAdminCourses` queries 3 tables directly without RPC, relying on client-side group_id filter + RLS

**File**: `src/hooks/use-admin-courses.ts`, lines 119-143

**Description**: Unlike the employees and hero stats data (which use SECURITY DEFINER RPCs with role checks), the courses hook queries `courses`, `course_enrollments`, and `employees` tables directly with `.eq('group_id', groupId)` filters. This relies on RLS to enforce access control rather than the explicit manager/admin role check used by the RPC functions.

**Impact**: If the `courses`, `course_enrollments`, or `employees` RLS policies allow any authenticated user in the group to SELECT (which is the standard RLS pattern for group-scoped data), then non-manager staff users could also query this data by calling the Supabase REST API directly, even though the UI hides it via `PositionGate`/`RoleGate`.

**Severity rationale**: This is a defense-in-depth gap. The data returned (course names, enrollment counts, scores) is not sensitive PII, but exposing detailed enrollment data to staff users may not be intended.

**Fix**: Create a `get_admin_courses()` RPC with SECURITY DEFINER and manager/admin role check, consistent with the pattern used for employees and hero stats.

---

### LOW

#### L1. `(supabase.rpc as any)()` type assertion pattern

**Files**:
- `src/hooks/use-admin-employees.ts` (line 31)
- `src/hooks/use-admin-hero-stats.ts` (lines 18, 49, 82)
- `src/components/admin-panel/AdminPanelShell.tsx` (line 92)

**Description**: The `(supabase.rpc as any)()` pattern is used throughout the admin hooks because the RPC function names are not yet in the generated Supabase types. The `as any` cast disables TypeScript type checking on the function name parameter and the arguments object.

**Impact**: This is not a direct injection risk because `supabase.rpc()` uses parameterized PostgREST calls. The function name is sent as a URL path segment, not as SQL. However, the `as any` pattern means:
1. Typos in function names will not be caught at compile time.
2. Incorrect parameter shapes will not be caught at compile time.
3. The return type is `any`, so null checks may be missing.

**Severity rationale**: No injection risk, but reduces type safety. This is a code quality concern.

**Fix**: Run `npx supabase gen types typescript` to regenerate types that include the new RPC functions, then remove the `as any` casts.

---

#### L2. `dangerouslySetInnerHTML` in WeeklyUpdateOverlay uses mock data with regex-based markdown

**File**: `src/components/admin-panel/overlays/WeeklyUpdateOverlay.tsx`, lines 98-104

**Description**: The overlay uses `dangerouslySetInnerHTML` to render bold-formatted text from `MOCK_WEEKLY_UPDATE`:

```tsx
dangerouslySetInnerHTML={{
  __html: para.replace(
    /\*\*(.*?)\*\*/g,
    '<strong class="text-foreground font-semibold">$1</strong>',
  ),
}}
```

Currently, the source data is a hardcoded mock constant (`MOCK_WEEKLY_UPDATE` in `src/data/mock-admin-panel.ts`), so there is no injection risk. However, when this is wired to live AI-generated weekly updates, the unescaped HTML insertion would become a stored XSS vector.

**Impact**: No current risk (mock data only). Future risk when wired to backend data.

**Fix**: When replacing mock data with live data, use a proper markdown renderer (e.g., `react-markdown`) or sanitize with DOMPurify before insertion.

---

#### L3. UnitSwitcher does not validate that the user actually has membership in the selected group

**File**: `src/contexts/UnitContext.tsx`, lines 65-70

**Description**: The `switchUnit()` function checks that the target `groupId` exists in `allMemberships` before switching. However, `allMemberships` is populated from a one-time query at login. If a user's group membership is revoked after the initial fetch, the client-side state will still allow switching to that group until the page is refreshed.

**Impact**: The user would switch to a group they no longer belong to, but all subsequent RPC calls would fail with "Unauthorized" because the server-side checks in the RPC functions verify membership at call time. This is a stale-state UX issue, not a security vulnerability.

**Severity rationale**: Server-side enforcement catches this. No data leak possible.

**Fix**: Consider adding a periodic re-fetch of memberships, or re-fetching on `switchUnit()`.

---

#### L4. REVOKE EXECUTE does not cover the `resolve_training_action` function

**File**: `supabase/migrations/20260316100400_revoke_execute_phase_e.sql`

**Description**: The Phase E REVOKE migration covers the 5 new Phase E functions but does not include `resolve_training_action` (created in Phase D at `20260315201100_create_resolve_training_action.sql`). I checked and this function appears to have its own REVOKE in Phase D's `20260315201400_revoke_execute_phase_d_system_functions.sql`, so this is likely covered, but worth confirming.

**Fix**: Verify that `resolve_training_action` is included in Phase D's REVOKE migration. If not, add it.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0     | -- |
| HIGH     | 2     | Cross-tenant enrollment leak in get_employee_detail; 11 edge functions still using CORS wildcard |
| MEDIUM   | 6     | PositionGate permissive fallback; jsonResponse default to wildcard; missing route; PII over-exposure; CORS_ALLOWED_ORIGIN not set; courses hook lacks RPC auth |
| LOW      | 4     | Type assertion pattern; future XSS risk in weekly overlay; stale membership state; REVOKE coverage gap |

### Positive Security Observations

1. **All 5 new SECURITY DEFINER functions have proper authorization checks** -- Each verifies `auth.uid()` is a manager/admin in the target group before returning data.
2. **All 5 functions have `SET search_path = public`** -- Prevents search_path hijacking.
3. **REVOKE EXECUTE from anon and public is applied** -- Defense-in-depth against unauthenticated RPC calls.
4. **`getCorsHeaders()` is well-designed** -- The origin-aware function correctly validates against an allowlist and falls back to a safe default.
5. **Auth role checks at the React Router level** -- The `ProtectedRoute` component enforces role requirements on admin routes.
6. **No exposed secrets in frontend code** -- All API keys are stored as Supabase secrets, not in client-side code.
7. **Employee detail RPC resolves group membership from the employee record** -- The function does NOT accept a `group_id` from the client, preventing IDOR attacks where an attacker supplies a different group.

---

## Recommended Actions

### Immediate (before production)

1. **Fix H1**: Add `AND ce.group_id = v_group_id` to the enrollment query in `get_employee_detail()`.
2. **Fix H2/M2**: Migrate remaining 11 edge functions from wildcard CORS to `getCorsHeaders()`. Update `jsonResponse`/`errorResponse` defaults.
3. **Fix M5**: Set `CORS_ALLOWED_ORIGIN` in Supabase secrets before production deployment.
4. **Fix M3**: Add the `/admin/training` route to `App.tsx` with `requiredRole={['manager', 'admin']}`.

### Short-term (next sprint)

5. **Fix M4**: Remove `phone` and `email` from the RPC return types (data minimization).
6. **Fix M6**: Replace direct table queries in `useAdminCourses` with an RPC that includes role checks.
7. **Fix L1**: Regenerate Supabase types and remove `as any` casts.
8. **Fix M1**: Change `PositionGate` fallback to deny-by-default when restrictions are specified but no employee record exists.

### Before wiring weekly updates to live data

9. **Fix L2**: Replace `dangerouslySetInnerHTML` with a sanitized markdown renderer.
