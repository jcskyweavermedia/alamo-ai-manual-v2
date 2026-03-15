# Security Review: Phase C -- AI Training Tools

**Reviewer:** security-reviewer agent
**Date:** 2026-03-14
**Scope:** SQL migrations (3), edge function (ask/index.ts -- training_manager sections), frontend hooks (2), frontend components (4)

---

## Security Review Scope

### Files reviewed

| Layer | File | Focus |
|-------|------|-------|
| SQL | `supabase/migrations/20260315200000_extend_constraints_for_training_manager.sql` | CHECK constraint updates |
| SQL | `supabase/migrations/20260315200100_create_training_manager_query_functions.sql` | 5 SECURITY DEFINER functions |
| SQL | `supabase/migrations/20260315200200_seed_training_manager_prompt.sql` | AI prompt seeding |
| Edge | `supabase/functions/ask/index.ts` | `handleTrainingManagerDomain`, `executeTrainingManagerTool`, `TRAINING_MANAGER_TOOLS` |
| Hook | `src/hooks/use-ask-training-manager.ts` | Client-side role gate, session management |
| Hook | `src/hooks/use-evaluations-dashboard.ts` | Evaluations query (RLS reliance) |
| UI | `src/components/admin-panel/hub/ManagerAIChat.tsx` | Message rendering |
| UI | `src/components/admin-panel/hub/EvaluationCard.tsx` | Evaluation display |
| UI | `src/components/admin-panel/hub/EvaluationsDashboard.tsx` | Dashboard container |
| UI | `src/components/admin-panel/hub/AIAskBar.tsx` | Input bar |

### Security concerns checklist

1. SQL injection in PG functions
2. IDOR / cross-group data access
3. Role-gating correctness
4. SECURITY DEFINER function search_path
5. XSS in chat message rendering
6. Sensitive data exposure
7. Rate limiting / usage enforcement
8. Session management / hijacking
9. Prompt injection vectors
10. RLS on evaluations queries

---

## Findings

### CRITICAL

*No critical findings.*

---

### HIGH

#### H-1. Cross-group data leakage in `get_course_training_analytics` problem_sections subquery

**File:** `supabase/migrations/20260315200100_create_training_manager_query_functions.sql`, lines 275-287
**Category:** IDOR / Broken Access Control (OWASP A01)

The `problem_sections` subquery aggregates quiz scores from `section_progress` filtered only by `p_course_id`, without any `group_id` filter. The `section_progress` table has no `group_id` column, and the outer query's `GROUP BY` on `course_enrollments.group_id` does NOT scope this correlated subquery:

```sql
-- Lines 275-287: No group_id filter -- aggregates ALL groups' quiz data
SELECT
  sp.section_id,
  cs.title_en AS section_title,
  ROUND(AVG(sp.quiz_score), 1) AS avg_quiz_score,
  COUNT(*) FILTER (WHERE sp.quiz_passed = false) AS fail_count
FROM public.section_progress sp
JOIN public.course_sections cs ON cs.id = sp.section_id
WHERE sp.course_id = p_course_id
  AND sp.quiz_score IS NOT NULL
GROUP BY sp.section_id, cs.title_en
ORDER BY AVG(sp.quiz_score) ASC NULLS LAST
LIMIT 5
```

**Impact:** If multiple restaurant groups share the same course (common in a multi-tenant SaaS), Group A's manager will see quiz failure data that includes Group B's employees. This leaks employee performance data across organizational boundaries.

**Fix:** Join `section_progress` to `course_enrollments` filtered by `p_group_id` to scope the subquery:

```sql
FROM public.section_progress sp
JOIN public.course_sections cs ON cs.id = sp.section_id
JOIN public.course_enrollments ce_inner
  ON ce_inner.id = sp.enrollment_id
  AND ce_inner.group_id = p_group_id
WHERE sp.course_id = p_course_id
  AND sp.quiz_score IS NOT NULL
```

---

#### H-2. `get_chat_history` has no ownership check (SECURITY DEFINER)

**File:** `supabase/migrations/20260211153126_create_unified_ai_tables.sql`, lines 317-356
**Category:** Broken Access Control (OWASP A01)

The `get_chat_history` function is `SECURITY DEFINER` and accepts a bare `_session_id` UUID parameter with no check that the calling user (`auth.uid()`) owns that session. Since the edge function calls this function using the **service role client** (line 1604 of `ask/index.ts`), RLS is bypassed entirely.

The session ID comes from either `get_or_create_chat_session` (which is safe -- creates for the current user) or from the client-supplied `body.sessionId` (line 1362):

```typescript
// Line 1362 in ask/index.ts
const activeSessionId = incomingSessionId || sessionId || "";
```

If an attacker supplies a valid `sessionId` belonging to another user in the request body, the edge function will load that user's conversation history into the AI context. While the attacker does not directly see the raw history messages in the response, the AI's answer will be influenced by them, potentially revealing sensitive information about another user's training queries.

**Impact:** Information disclosure via AI context poisoning. An attacker with a valid session UUID from another user could influence the AI to reveal prior conversation content.

**Fix:** Add an ownership check to `get_chat_history`:

```sql
-- At the start of the function body:
IF NOT EXISTS (
  SELECT 1 FROM public.chat_sessions
  WHERE id = _session_id AND user_id = auth.uid()
) THEN
  RETURN;
END IF;
```

Or, in the edge function, validate that the incoming session ID belongs to the authenticated user before using it (using the auth-scoped Supabase client, not service role).

---

### MEDIUM

#### M-1. Wildcard CORS allows any origin

**File:** `supabase/functions/ask/index.ts`, line 34
**Category:** Security Misconfiguration (OWASP A05)

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  ...
};
```

The `Access-Control-Allow-Origin: *` header allows any website to make requests to the edge function. While the function requires a valid JWT for authentication, this still:
- Enables CSRF-like attacks from malicious websites if the user has an active session
- Makes it possible for third-party sites to probe the API

**Impact:** Medium. Auth is enforced, so direct data theft requires a valid token, but a malicious site could leverage a user's open browser session.

**Fix:** Restrict the origin to your deployment domain(s):

```typescript
const ALLOWED_ORIGINS = [
  "http://localhost:8080",
  "https://your-production-domain.com",
];

const origin = req.headers.get("Origin") || "";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  ...
};
```

---

#### M-2. No upper bound on `p_limit` parameter in `get_team_training_summary`

**File:** `supabase/migrations/20260315200100_create_training_manager_query_functions.sql`, lines 29, 81
**Category:** Denial of Service / Resource Exhaustion

```sql
p_limit INT DEFAULT 25
...
LIMIT p_limit;
```

The AI can pass any integer value for `limit` via the tool call arguments (line 621 of `ask/index.ts`):

```typescript
if (toolArgs.limit) params.p_limit = toolArgs.limit;
```

A prompt injection attack or adversarial AI behavior could request `limit: 999999`, causing the database to return and serialize a massive result set.

**Impact:** Server-side resource exhaustion, slow responses, potential OOM on the edge function.

**Fix:** Clamp `p_limit` in the PG function:

```sql
p_limit := LEAST(COALESCE(p_limit, 25), 100);
```

And/or enforce a maximum in the edge function before passing to RPC.

---

#### M-3. Prompt injection risk: AI-controlled `employee_id` and `course_id` parameters

**File:** `supabase/functions/ask/index.ts`, lines 617-636
**Category:** Injection / Prompt Injection

While `group_id` is correctly injected server-side (line 615), the `employee_id`, `course_id`, and `program_id` parameters come from the AI's tool call arguments, which are influenced by user input:

```typescript
case "get_employee_training_detail":
  if (toolArgs.employee_id) params.p_employee_id = toolArgs.employee_id;
  ...
case "get_course_training_analytics":
  params.p_course_id = toolArgs.course_id;
```

A crafted prompt like *"Look up the employee with ID 550e8400-e29b-41d4-a716-446655440000"* could trick the AI into passing arbitrary UUIDs. However, the PG functions enforce `e.group_id = p_group_id` and `ce.group_id = p_group_id`, so the data returned is still scoped to the caller's group.

**Impact:** Low actual risk due to group scoping in PG functions, but the attack surface exists. If a future function is added without group scoping, this becomes an IDOR vector.

**Mitigating controls already in place:**
- All 5 PG functions check `e.group_id = p_group_id` or `ce.group_id = p_group_id`
- All 5 PG functions verify `auth.uid()` is a manager/admin in the target group

**Recommendation:** Add a comment documenting that all new training manager PG functions MUST enforce `group_id` scoping. Consider validating UUID format in the edge function before passing to RPC.

---

#### M-4. Evaluations dashboard relies solely on RLS for group scoping -- no client-side groupId filter validation

**File:** `src/hooks/use-evaluations-dashboard.ts`, lines 63-80
**Category:** Broken Access Control (OWASP A01)

The hook uses the anon-key Supabase client and filters by `primaryGroup.groupId`:

```typescript
.eq('group_id', primaryGroup.groupId)
```

This is safe because RLS is enforced (`"Managers can view group evaluations"` policy at line 113-118 of the evaluations migration). However, the `primaryGroup` is derived from `permissions?.memberships?.[0]`, which takes the **first** membership. If a user belongs to multiple groups, this may not be the intended group.

**Impact:** Low -- RLS prevents cross-group access, but a user with multiple memberships may see evaluations from their first group rather than the intended one.

**Fix:** Allow the dashboard to accept a `groupId` prop or add group selection logic.

---

#### M-5. Error messages in PG functions leak tool names

**File:** `supabase/functions/ask/index.ts`, lines 644-647
**Category:** Information Disclosure (OWASP A04)

```typescript
if (error) {
  console.error(`[ask:training_manager] RPC error (${toolName}):`, error.message);
  return `Error querying ${toolName}: ${error.message}`;
}
```

The error string including the internal function name (`get_team_training_summary`, etc.) and the database error message is returned to the AI, which may include it verbatim in its response to the user. The AI prompt includes a guardrail ("Never reveal internal function names or parameters"), but this is not enforced programmatically.

**Impact:** Internal database error messages and function names could leak to the end user through the AI response.

**Fix:** Return a generic error to the AI:

```typescript
return `Error retrieving data. The query could not be completed.`;
```

Log the detailed error server-side only.

---

### LOW

#### L-1. No XSS risk in chat rendering -- safe patterns used

**File:** `src/components/admin-panel/hub/ManagerAIChat.tsx`, lines 57-63
**Category:** XSS (OWASP A03)

The component renders message content using `{msg.content}` inside a `<div>` with `whitespace-pre-wrap` class. This is safe -- React's JSX auto-escapes text content by default. No `dangerouslySetInnerHTML` is used. No markdown parser that could inject raw HTML is present.

**Finding:** No vulnerability. Text is rendered safely.

---

#### L-2. Evaluation feedback arrays rendered safely

**File:** `src/components/admin-panel/hub/EvaluationCard.tsx`, lines 83-100
**Category:** XSS (OWASP A03)

The `student_feedback.strengths` and `areas_for_improvement` arrays are rendered as `{s}` inside `<span>` elements. React auto-escapes these. No risk.

**Finding:** No vulnerability.

---

#### L-3. AI prompt instructs guardrails but cannot enforce them

**File:** `supabase/migrations/20260315200200_seed_training_manager_prompt.sql`, lines 59-64
**Category:** Defense in Depth

The prompt includes guardrails:
- "Never share raw database IDs with the manager"
- "Never reveal internal function names or parameters"
- "Never fabricate employee names, scores, or progress"

These are soft controls -- the AI may violate them if given adversarial input. The `executeTrainingManagerTool` function currently returns formatted data that includes raw field names (`employee_id`, `display_name`, etc.). The AI may echo these.

**Impact:** Low -- primarily a UX/information-disclosure issue, not a security breach.

**Recommendation:** Strip UUIDs and internal field names from tool results before returning them to the AI. Or post-process the AI response to redact UUIDs.

---

#### L-4. Session message_count update is not atomic

**File:** `supabase/functions/ask/index.ts`, lines 1499-1511
**Category:** Race Condition

```typescript
const { data: session } = await supabase
  .from("chat_sessions")
  .select("message_count")
  .eq("id", activeSessionId)
  .single();

await supabase
  .from("chat_sessions")
  .update({
    message_count: (session?.message_count || 0) + 2,
    ...
  })
  .eq("id", activeSessionId);
```

This fetch-then-update pattern is not atomic. If two concurrent requests hit the same session, the count could be incorrect. However, the training manager UI is single-user per session, so concurrent requests are unlikely.

**Impact:** Minimal -- message count may be off by 2 in rare race conditions. No security impact.

**Fix:** Use a SQL `UPDATE ... SET message_count = message_count + 2` instead.

---

## Summary

| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 0 | -- |
| HIGH | 2 | Cross-group data leakage in problem_sections; session history ownership bypass |
| MEDIUM | 5 | Wildcard CORS; unbounded p_limit; prompt injection surface; multi-group ambiguity; error message leaks |
| LOW | 4 | Safe XSS patterns (no action); soft AI guardrails; non-atomic counter |

### What went right

1. **group_id injection is server-side** -- the edge function ALWAYS injects `groupId` from the authenticated user's context, never trusting the AI's tool call arguments for this parameter. This is the most important security control.

2. **All 5 PG functions have role checks** -- every function verifies `auth.uid()` is a manager/admin in the target group before executing.

3. **All 5 PG functions use `SECURITY DEFINER` + `SET search_path = public`** -- correctly configured to prevent search_path hijacking.

4. **All 5 PG functions use parameterized queries** -- no string concatenation or dynamic SQL. No SQL injection risk.

5. **Frontend role check is defense-in-depth** -- the hook checks role client-side, AND the edge function checks server-side, AND the PG functions check at the database level. Triple-layer authorization.

6. **Usage limits are enforced** -- rate limiting via `get_user_usage` + `increment_usage` is checked before AI calls.

7. **No XSS vectors** -- React auto-escaping is used throughout. No `dangerouslySetInnerHTML`, no markdown-to-HTML rendering, no innerHTML.

8. **Evaluations RLS is properly configured** -- group-scoped SELECT policies for managers, user-scoped SELECT for own evaluations, no DELETE policy (audit trail).

---

## Recommended Actions

### Priority 1 (Before deployment)

1. **Fix H-1:** Add `JOIN course_enrollments ce_inner ON ce_inner.id = sp.enrollment_id AND ce_inner.group_id = p_group_id` to the `problem_sections` subquery in `get_course_training_analytics`.

2. **Fix H-2:** Add session ownership validation -- either in `get_chat_history` (check `auth.uid()` matches session owner) or in the edge function (validate incoming `sessionId` belongs to the authenticated user before using it).

### Priority 2 (Near-term hardening)

3. **Fix M-2:** Clamp `p_limit` in the PG function: `p_limit := LEAST(COALESCE(p_limit, 25), 100);`

4. **Fix M-5:** Return generic error messages to the AI, log details server-side only.

5. **Fix M-1:** Restrict CORS to known origins (localhost + production domain).

### Priority 3 (Improvement)

6. **L-4:** Use atomic counter update: `SET message_count = message_count + 2`.

7. **L-3:** Strip UUIDs from tool results before passing to the AI, or post-process AI responses to redact them.

8. **M-3:** Document the invariant that all training manager PG functions must enforce `group_id` scoping.
