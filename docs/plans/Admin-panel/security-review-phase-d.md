# Security Review: Phase D -- Auto-Assignment + Insights

**Reviewer**: security-reviewer agent
**Date**: 2026-03-14
**Scope**: 9 SQL migrations, 1 edge function (modified), 3 frontend hooks, 5 frontend components
**Verdict**: 2 HIGH, 4 MEDIUM, 3 LOW findings

---

# Security Review Scope

## Files Reviewed

### SQL Migrations (9 files)
1. `supabase/migrations/20260315200500_create_phase_d_tables.sql` -- Tables: training_actions, notifications, training_insights
2. `supabase/migrations/20260315200600_seed_position_training_requirements.sql` -- Seed data
3. `supabase/migrations/20260315200700_create_phase_d_helper_functions.sql` -- send_notification, mark_notification_read, expire_stale_training_actions
4. `supabase/migrations/20260315200800_create_generate_training_insights.sql` -- Weekly insight generation
5. `supabase/migrations/20260315200900_create_pending_actions_insights_functions.sql` -- get_pending_actions, get_recent_insights
6. `supabase/migrations/20260315201000_create_run_auto_enrollment.sql` -- Auto-enrollment engine
7. `supabase/migrations/20260315201100_create_resolve_training_action.sql` -- Manager action resolution
8. `supabase/migrations/20260315201200_create_auto_enroll_trigger.sql` -- Employee link trigger
9. `supabase/migrations/20260315201300_schedule_phase_d_crons.sql` -- pg_cron jobs

### Edge Function
- `supabase/functions/ask/index.ts` -- New tool definitions (get_pending_actions, get_recent_insights) and handler cases

### Frontend Hooks (3 new)
- `src/hooks/use-training-actions.ts`
- `src/hooks/use-notifications.ts`
- `src/hooks/use-training-insights.ts`

### Frontend Components (5 files)
- `src/components/admin-panel/notifications/NotificationBell.tsx`
- `src/components/admin-panel/notifications/NotificationDropdown.tsx`
- `src/components/admin-panel/notifications/NotificationItem.tsx`
- `src/components/admin-panel/AdminPanelShell.tsx`
- `src/components/admin-panel/hub/AIHubView.tsx`

---

# Findings

## CRITICAL

No CRITICAL findings.

---

## HIGH

### H1. SECURITY DEFINER functions callable by any authenticated user -- privilege escalation

**Files**:
- `supabase/migrations/20260315200700_create_phase_d_helper_functions.sql` (lines 13-35, 70-87)
- `supabase/migrations/20260315201000_create_run_auto_enrollment.sql` (lines 17-185)
- `supabase/migrations/20260315200800_create_generate_training_insights.sql` (lines 17-345)

**Description**: Four SECURITY DEFINER functions lack `REVOKE EXECUTE` from authenticated/anon roles:

1. **`send_notification()`** -- Any authenticated user can call this directly via `supabase.rpc('send_notification', {...})` and insert a notification to ANY user in ANY group with arbitrary content. There is zero authorization inside the function. This allows:
   - Notification spoofing (fake "New Training Assignment" notifications to any user)
   - Cross-group notification injection (attacker specifies arbitrary `p_group_id` and `p_user_id`)
   - Social engineering via fake system messages

2. **`expire_stale_training_actions()`** -- Any authenticated user can call this and prematurely expire all pending training actions across all groups. While the function itself only expires truly stale actions (past `expires_at`), there is no need for user-callable access.

3. **`run_auto_enrollment()`** -- Any authenticated user can trigger the full auto-enrollment engine across ALL groups. This iterates every group's `position_training_requirements` and creates enrollments, actions, and notifications. While idempotent, this is a system-level operation that should only run via pg_cron.

4. **`generate_training_insights()`** -- Any authenticated user can trigger insight generation across ALL groups. Should only run via pg_cron.

**Precedent**: The codebase already established the `REVOKE EXECUTE` pattern in `20260225235000_harden_rollup_functions.sql` for the review rollup functions (`rollup_daily_flavor_index`, `rollup_review_intelligence`, `run_daily_review_rollups`).

**Risk**: HIGH -- `send_notification` is directly exploitable for cross-group notification spoofing. The cron-only functions are lower risk individually but violate least-privilege.

**Fix**:
```sql
-- Restrict cron-only functions (only postgres role needs access for pg_cron)
REVOKE EXECUTE ON FUNCTION public.send_notification(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_training_actions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_auto_enrollment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_training_insights() FROM PUBLIC, anon, authenticated;
```

Note: `send_notification` is only called from other SECURITY DEFINER functions (`resolve_training_action`, `run_auto_enrollment`, `trg_auto_enroll_on_employee_link`), which execute as the function owner (postgres). The REVOKE will not break internal calls.

---

### H2. Error message leakage from PG functions to AI to user

**File**: `supabase/functions/ask/index.ts` (lines 688-690)

**Code**:
```typescript
if (error) {
  console.error(`[ask:training_manager] RPC error (${toolName}):`, error.message);
  return `Error querying ${toolName}: ${error.message}`;
}
```

**Description**: When a PG function call fails (e.g., `get_pending_actions`, `get_recent_insights`, or any training manager tool), the raw error message including the function name and PostgreSQL error details is returned as the tool result text to the OpenAI model. The AI then incorporates this into its response to the user, potentially exposing:

- Internal function names (`get_pending_actions`, `get_team_training_summary`, etc.)
- PostgreSQL error details (table names, constraint names, permission errors)
- Database schema information that aids reconnaissance

This exact pattern was previously identified as a known risk in the project's security memory notes.

**Risk**: HIGH -- Information disclosure. Internal database schema, function names, and error details leak to end users through the AI's response.

**Fix**: Return a generic error message to the AI:
```typescript
if (error) {
  console.error(`[ask:training_manager] RPC error (${toolName}):`, error.message);
  return "Unable to retrieve the requested data. Please try again.";
}
```

---

## MEDIUM

### M1. Unbounded result sets in get_pending_actions and get_recent_insights

**File**: `supabase/migrations/20260315200900_create_pending_actions_insights_functions.sql` (lines 42-61, 98-116)

**Description**: Neither `get_pending_actions` nor `get_recent_insights` has a `LIMIT` clause. While these functions are scoped to a single group and filtered (`status = 'pending'` and `superseded_by IS NULL` respectively), a group with many pending actions or accumulated insights (e.g., `employee_alert` and `milestone` types accumulate without supersession) could return unbounded rows.

When called through the AI tool-use pipeline, large result sets:
1. Consume excessive OpenAI tokens (cost impact)
2. May exceed context window limits, causing truncated or degraded AI responses
3. Can slow down response times significantly

**Risk**: MEDIUM -- Primarily a cost/performance/reliability concern, not direct data leakage. But a group with many employees generating weekly alerts could accumulate hundreds of non-superseded `employee_alert` insights.

**Fix**: Add a `LIMIT` clause (e.g., `LIMIT 50`) to both queries, or add a `p_limit` parameter with a default and cap:
```sql
-- In get_pending_actions, after ORDER BY:
LIMIT LEAST(COALESCE(p_limit, 50), 100);

-- In get_recent_insights, after ORDER BY:
LIMIT LEAST(COALESCE(p_limit, 50), 100);
```

---

### M2. Cross-group data exposure via LEFT JOINs in SECURITY DEFINER functions

**File**: `supabase/migrations/20260315200900_create_pending_actions_insights_functions.sql` (lines 54-57)

**Code**:
```sql
FROM public.training_actions ta
LEFT JOIN public.employees e ON ta.target_employee_id = e.id
LEFT JOIN public.training_programs tp ON ta.target_program_id = tp.id
LEFT JOIN public.courses c ON ta.target_course_id = c.id
WHERE ta.group_id = p_group_id
```

**Description**: The `get_pending_actions` function is SECURITY DEFINER, which means RLS is bypassed. The LEFT JOINs to `employees`, `training_programs`, and `courses` are on primary key (`id`) only, without scoping to `group_id`. In the current data model, `training_actions.target_employee_id` references an employee that should always belong to the same group. However:

1. If a bug or data integrity issue causes a `training_action` to reference an employee/program/course from a different group, that foreign group's data (display_name, title_en) would be returned.
2. This is a defense-in-depth concern -- the outer WHERE clause on `training_actions.group_id` is the primary control.

The same pattern exists in the `generate_training_insights` function (migration `20260315200800`), where JOINs to `course_enrollments`, `section_progress`, `employees`, `courses`, and `evaluations` are scoped by `v_group.id` on the driving table and also include `e.group_id = v_group.id` on the employees join. This is the correct pattern.

**Risk**: MEDIUM -- Defense-in-depth gap. Unlikely to be exploitable in normal operations, but violates the established scoping pattern seen elsewhere in the codebase (where every subquery and join is independently scoped to group_id).

**Fix**: Add group_id conditions to the LEFT JOINs:
```sql
LEFT JOIN public.employees e
  ON ta.target_employee_id = e.id AND e.group_id = p_group_id
LEFT JOIN public.training_programs tp
  ON ta.target_program_id = tp.id AND tp.group_id = p_group_id
```

---

### M3. CORS wildcard on edge function

**File**: `supabase/functions/ask/index.ts` (lines 33-37)

**Code**:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  ...
};
```

**Description**: The `Access-Control-Allow-Origin: *` header allows any origin to call the edge function. While authentication is enforced via JWT (the `Authorization` header is validated), this wildcard CORS policy means a malicious site could issue requests to the endpoint if a user has a valid session. The credential-bearing `Authorization` header is not a browser-managed credential (it's set by JavaScript), so the practical risk is limited -- but it broadens the attack surface for phishing scenarios where an attacker tricks a user into visiting a page that extracts their stored token and makes API calls.

**Risk**: MEDIUM -- Pre-existing issue (not Phase D specific), but worth flagging for production hardening.

**Fix**: Restrict to known origins:
```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "https://alamo-prime.your-domain.com",
];
const origin = req.headers.get("Origin") || "";
const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
```

---

### M4. Notification query in use-notifications hook missing group_id filter

**File**: `src/hooks/use-notifications.ts` (lines 46-51)

**Code**:
```typescript
const { data, error: queryError } = await supabase
  .from('notifications')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(50);
```

**Description**: The notifications query does not include a `.eq('group_id', primaryGroup.groupId)` filter, unlike the other two hooks (`use-training-actions.ts` line 57 and `use-training-insights.ts` line 50) which both filter by group_id. This relies entirely on the RLS policy `USING (user_id = auth.uid())` for security.

While the RLS policy correctly scopes to the current user's notifications (so no cross-user data leakage occurs), the missing client-side filter means:

1. If a user belongs to multiple groups, they will see notifications from ALL groups, not just the active one. This may be unintended.
2. The query pattern is inconsistent with the other two hooks, suggesting an oversight.

**Risk**: MEDIUM -- No actual data leakage (RLS is correct), but the behavioral inconsistency with other hooks suggests this is a bug rather than intentional design. In a multi-unit deployment, users would see notifications from groups they are not currently managing.

**Fix**: Add group filter for consistency:
```typescript
const { data, error: queryError } = await supabase
  .from('notifications')
  .select('*')
  .eq('group_id', primaryGroup.groupId)
  .order('created_at', { ascending: false })
  .limit(50);
```

---

## LOW

### L1. Client-side role check for notification bell visibility (UX only, not a security control)

**File**: `src/components/admin-panel/AdminPanelShell.tsx` (lines 49-50, 121-125)

**Code**:
```typescript
const { isAdmin, isManager } = useAuth();
const showNotifications = isAdmin || isManager;
// ...
{showNotifications && (
  <div className="absolute right-4 top-1/2 -translate-y-1/2">
    <NotificationBell />
  </div>
)}
```

**Description**: The notification bell is conditionally rendered based on client-side role checks. This is a UX convenience that hides the bell for non-managers, but it is not a security control. The actual security enforcement is correctly in place:

- RLS policy on `notifications` table: `USING (user_id = auth.uid())` -- users can only see their own notifications
- `mark_notification_read()` function: checks `AND user_id = auth.uid()` -- users can only mark their own notifications

This is consistent with the project pattern (client-side role checks are UX guards, server-side is the real control).

**Risk**: LOW -- Correctly implemented pattern. Noted for completeness.

---

### L2. Notification content injection via display_data

**File**: `supabase/migrations/20260315201100_create_resolve_training_action.sql` (lines 185-186)

**Code**:
```sql
COALESCE(v_action.display_data->>'title', 'Training Reminder'),
COALESCE(v_action.display_data->>'description', 'Please continue your training.'),
```

**Description**: The `resolve_training_action` function sends nudge notifications using the `display_data` JSONB field from the training action. The `display_data` is written by system-level functions (`generate_training_insights`, `run_auto_enrollment`) which construct the content from database fields like `employee.display_name`. A manager could theoretically create a training action via the INSERT RLS policy with crafted `display_data` containing misleading notification text.

However, the notification content is rendered in React JSX (`{n.title}`, `{n.body}` in `NotificationItem.tsx` lines 94-100), which auto-escapes HTML. There is no XSS risk.

**Risk**: LOW -- The content is auto-escaped by React. The worst case is a manager creating a misleading notification for their own group's employees, which is within their authority.

---

### L3. Seed migration hardcodes group slug

**File**: `supabase/migrations/20260315200600_seed_position_training_requirements.sql` (line 19)

**Code**:
```sql
WHERE g.slug = 'alamo-prime'
```

**Description**: The seed migration only creates position training requirements for the `alamo-prime` group. This is expected for initial deployment but means other groups would not have auto-enrollment configured. This is not a vulnerability, just a limitation to be aware of for multi-tenant deployment.

**Risk**: LOW -- Operational awareness only.

---

# Summary

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 0 | -- |
| HIGH | 2 | Missing REVOKE EXECUTE on SECURITY DEFINER functions; Error message leakage to AI/user |
| MEDIUM | 4 | Unbounded queries; Cross-group JOIN scoping; CORS wildcard; Missing group filter in notifications hook |
| LOW | 3 | Client-side role check (correct pattern); Content injection (auto-escaped); Hardcoded seed slug |

## What Went Well

1. **RLS policies are comprehensive**: All three new tables (`training_actions`, `notifications`, `training_insights`) have properly scoped RLS policies with correct role-based access.
2. **SECURITY DEFINER + search_path**: All 8 new PG functions correctly set `SET search_path = public`, following the established security pattern.
3. **Authorization checks in query functions**: Both `get_pending_actions` and `get_recent_insights` verify the caller is a manager/admin in the target group via `group_memberships` lookup before returning data.
4. **resolve_training_action authorization**: The function correctly fetches the action first, then verifies the caller is a manager/admin in that action's group.
5. **Notification ownership**: `mark_notification_read` correctly checks `user_id = auth.uid()`, and the notification SELECT RLS policy also scopes to `user_id = auth.uid()`.
6. **Edge function group_id injection**: The `executeTrainingManagerTool` function always injects `p_group_id` from the server-side `groupId` variable (line 653), never from AI tool call arguments. This is the correct pattern.
7. **Frontend uses React auto-escaping**: All notification content is rendered via JSX expressions (`{n.title}`, `{n.body}`), not `dangerouslySetInnerHTML`. No XSS vectors.
8. **Session ownership validation**: The training manager handler validates incoming session IDs against the authenticated user (lines 1407-1419).
9. **Idempotent enrollment**: Both `run_auto_enrollment` and the trigger use `ON CONFLICT DO NOTHING`, preventing duplicate enrollments.
10. **Input validation in resolve_training_action**: The function validates `p_resolution` is one of `'approved'` or `'skipped'` before proceeding.

---

# Recommended Actions

## Must Fix Before Production (HIGH)

1. **Create a hardening migration** with `REVOKE EXECUTE` for all four Phase D SECURITY DEFINER utility/cron functions: `send_notification`, `expire_stale_training_actions`, `run_auto_enrollment`, `generate_training_insights`.

2. **Replace raw error forwarding** in `executeTrainingManagerTool` (line 690) with a generic message. Log the real error server-side (already done), return `"Unable to retrieve the requested data. Please try again."` to the AI.

## Should Fix (MEDIUM)

3. **Add LIMIT clauses** to `get_pending_actions` (e.g., `LIMIT 100`) and `get_recent_insights` (e.g., `LIMIT 100`).

4. **Add group_id scoping** to LEFT JOINs in `get_pending_actions` for defense-in-depth.

5. **Add `.eq('group_id', primaryGroup.groupId)` filter** to the notifications query in `use-notifications.ts`.

6. **Restrict CORS origins** for production deployment (pre-existing issue, not Phase D specific).

## Optional Improvements (LOW)

7. Verify seed migration is updated when onboarding new groups (operational).
