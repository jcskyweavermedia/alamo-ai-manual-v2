# Phase D: Auto-Assignment + Insights — Implementation Plan

Source: Master Implementation Plan (Phase D), software-architect + task-planner + devils-advocate review.

---

## Architecture Summary

Phase D adds 4 capabilities to the training system:

1. **Auto-enrollment engine** — PG function + cron that matches employees to `position_training_requirements`, creating `course_enrollments` for each published course in required programs (auto-executed) and pending `training_actions` for optional programs (awaiting manager approval).

2. **Training insights generator** — PG function (deterministic SQL, no AI) that computes weekly team stats, stalled employees, course health, milestones. Stored in `training_insights` table.

3. **In-app notifications** — `notifications` table consumed via polling (Realtime upgrade optional). NotificationBell in admin shell header.

4. **Manager approval flow** — `training_actions` table as proposal pipeline. Existing mock `AISuggestionsCard` wired to live data with approve/skip handlers.

## Key Design Decisions

- **Required training auto-executes** (no manager approval). Optional creates pending action.
- **PG functions for all logic** — no new edge functions. Auto-enrollment + insights are SQL, not AI.
- **Enrollments are per-course**, not per-program. The function looks up `courses WHERE program_id = X AND status = 'published'` and creates one `course_enrollment` per course. Also upserts `program_enrollment`.
- **In-app notifications only** — no SMS/email (deferred to Phase E).
- **Singular `target_employee_id`** — one training_action per employee. No array, no aggregation.
- **Trigger on `employees.profile_id`** change (NULL→non-NULL) for instant enrollment. Daily cron as safety net.
- **Pre-computed `display_data` JSONB** in training_actions (denormalized, 14-day TTL via expiry).
- **Polling for notifications** (not Realtime). Can upgrade later if `sb_publishable_` key works with Realtime.
- **Programs with status != 'published' are skipped** by auto-enrollment (no enrolling in coming_soon programs).

## Program-to-Course Resolution (Critical)

```
position_training_requirements.program_id
  → training_programs WHERE status = 'published'
    → courses WHERE program_id = X AND status = 'published'
      → INSERT course_enrollments (one per course)
      → UPSERT program_enrollments
```

---

## Tasks

### Milestone 1: Database Foundation

#### [x] D1: Create `training_actions`, `notifications`, and `training_insights` tables

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_phase_d_tables.sql`

**Dependencies**: None.

**Tables**:

1. **training_actions**:
   - `id UUID PK (extensions.gen_random_uuid())`
   - `group_id UUID NOT NULL FK→groups`
   - `action_type TEXT NOT NULL` CHECK: `auto_enroll`, `nudge`, `contest`, `insight`
   - `status TEXT NOT NULL DEFAULT 'pending'` CHECK: `pending`, `approved`, `skipped`, `executed`, `expired`
   - `source TEXT NOT NULL DEFAULT 'system'` CHECK: `system`, `ai`, `manager`
   - `target_employee_id UUID FK→employees` (nullable)
   - `target_program_id UUID FK→training_programs` (nullable)
   - `target_course_id UUID FK→courses` (nullable)
   - `display_data JSONB NOT NULL DEFAULT '{}'` — pre-computed AISuggestion fields
   - `resolved_by UUID FK→profiles` (nullable)
   - `resolved_at TIMESTAMPTZ` (nullable)
   - `resolution_note TEXT` (nullable)
   - `expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days')`
   - `created_at, updated_at TIMESTAMPTZ`
   - Indexes: `(group_id, status)`, `target_employee_id`, `expires_at WHERE status = 'pending'`
   - RLS: SELECT for group members, INSERT/UPDATE for manager/admin, DELETE for admin
   - Trigger: `set_updated_at()`

2. **notifications**:
   - `id UUID PK (extensions.gen_random_uuid())`
   - `group_id UUID NOT NULL FK→groups`
   - `user_id UUID NOT NULL FK→profiles` (recipient)
   - `type TEXT NOT NULL` CHECK: `nudge`, `assignment`, `reminder`, `announcement`
   - `title TEXT NOT NULL`
   - `body TEXT` (nullable)
   - `metadata JSONB NOT NULL DEFAULT '{}'`
   - `read BOOLEAN NOT NULL DEFAULT false`
   - `read_at TIMESTAMPTZ` (nullable)
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Indexes: `(user_id, read) WHERE read = false`, `group_id`, `created_at DESC`
   - RLS: SELECT own (`user_id = auth.uid()`), INSERT for manager/admin in group, UPDATE own (mark read)

3. **training_insights**:
   - `id UUID PK (extensions.gen_random_uuid())`
   - `group_id UUID NOT NULL FK→groups`
   - `insight_type TEXT NOT NULL` CHECK: `team_weekly`, `employee_alert`, `course_health`, `milestone`
   - `severity TEXT NOT NULL DEFAULT 'info'` CHECK: `info`, `warning`, `critical`
   - `title TEXT NOT NULL`
   - `body TEXT` (nullable)
   - `data JSONB NOT NULL DEFAULT '{}'`
   - `period_start DATE NOT NULL`
   - `period_end DATE NOT NULL`
   - `superseded_by UUID FK→self` (nullable)
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Indexes: `(group_id, insight_type)`, `superseded_by IS NULL` (partial)
   - RLS: SELECT for manager/admin in group only

**Acceptance Criteria**:
1. All 3 tables created with correct columns, constraints, indexes
2. RLS enabled with proper policies
3. `set_updated_at()` trigger on training_actions
4. `echo y | npx supabase db push` succeeds

---

#### [x] D2: Seed `position_training_requirements` for Alamo Prime

**File**: `supabase/migrations/YYYYMMDDHHMMSS_seed_position_training_requirements.sql`

**Dependencies**: None (table already exists from Phase A).

**What**:
- Seed rows for Alamo Prime group linking FOH positions to Server 101 program:
  - Server → Server 101 (required=true, due_within_days=30)
  - Host → Server 101 (required=true, due_within_days=30)
  - Busser → Server 101 (required=true, due_within_days=30)
  - Runner → Server 101 (required=true, due_within_days=30)
  - Bartender → Server 101 (required=true, due_within_days=30)
- Uses deterministic UUID for group_id (must look up from `groups` table)
- `ON CONFLICT (group_id, position, program_id) DO NOTHING` for idempotency
- Looks up Server 101 program_id via subquery on `training_programs WHERE slug = 'server-101'`

**Acceptance Criteria**:
1. 5 rows inserted into `position_training_requirements`
2. `echo y | npx supabase db push` succeeds

---

### Milestone 2: Core PG Functions

#### [x] D3: Create helper functions (`send_notification`, `mark_notification_read`, `expire_stale_training_actions`)

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_phase_d_helper_functions.sql`

**Dependencies**: D1 (tables).

**Functions**:

1. **`send_notification(p_group_id, p_user_id, p_type, p_title, p_body, p_metadata)`**
   - SECURITY DEFINER, SET search_path = public
   - INSERTs into notifications, returns new row

2. **`mark_notification_read(p_notification_id)`**
   - SECURITY DEFINER, SET search_path = public
   - Verifies `auth.uid()` matches notification's user_id
   - Sets `read = true, read_at = now()`

3. **`expire_stale_training_actions()`**
   - SECURITY DEFINER, SET search_path = public
   - Updates `status = 'expired'` WHERE `status = 'pending' AND expires_at < now()`
   - Returns count of expired rows

**Acceptance Criteria**:
1. All 3 functions created successfully
2. `echo y | npx supabase db push` succeeds
3. Verified: send_notification creates row, mark_notification_read flips flag, expire function changes status

---

#### [x] D4: Create `run_auto_enrollment()` function

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_run_auto_enrollment.sql`

**Dependencies**: D1, D2, D3 (tables, seed data, send_notification).

**Logic** (CRITICAL — program-to-course resolution):
```
FOR each group:
  FOR each employee WHERE employment_status IN ('active','onboarding') AND profile_id IS NOT NULL:
    FOR each position_training_requirement matching employee.position AND employee.group_id:
      -- Skip programs that aren't published
      IF program.status != 'published' THEN CONTINUE

      FOR each course WHERE program_id = req.program_id AND status = 'published':
        IF NOT EXISTS course_enrollment(user_id=employee.profile_id, course_id=course.id):
          IF requirement.required = true:
            INSERT course_enrollments (user_id, course_id, group_id, status='enrolled',
              expires_at = COALESCE(employee.hire_date, now()) + due_within_days * INTERVAL '1 day')
              ON CONFLICT (user_id, course_id) DO NOTHING
            INSERT training_actions (action_type='auto_enroll', status='executed', source='system', ...)
            CALL send_notification(employee.profile_id, 'assignment', ...)
          ELSE (required = false):
            IF NOT EXISTS training_action(target_employee_id, target_program_id, status='pending'):
              INSERT training_actions (action_type='auto_enroll', status='pending', source='system', ...)

      -- Also upsert program_enrollment
      INSERT program_enrollments ON CONFLICT DO UPDATE
```

**Key rules**:
- Idempotent: ON CONFLICT DO NOTHING on course_enrollments
- Skips employees with `profile_id IS NULL`
- Skips programs with `status != 'published'`
- `expires_at` = `COALESCE(hire_date, CURRENT_DATE) + due_within_days * INTERVAL '1 day'`
- Pre-computes `display_data` JSONB for training_actions at insertion time
- Returns `(enrollments_created INT, actions_proposed INT)`

**Acceptance Criteria**:
1. SECURITY DEFINER + SET search_path = public
2. Running twice with same data produces no duplicates
3. Creates course_enrollments + training_actions + notifications for required programs
4. Creates only pending training_actions for optional programs
5. Skips employees without profile_id
6. Skips unpublished programs/courses

---

#### [x] D5: Create `resolve_training_action()` function

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_resolve_training_action.sql`

**Dependencies**: D1, D3 (tables, send_notification).

**Logic**:
- Validates `p_resolution IN ('approved', 'skipped')`
- Security check: caller must be manager/admin in the action's group
- Updates training_actions: status → `executed` (if approved) or `skipped`, resolved_by, resolved_at, resolution_note
- If approved + auto_enroll:
  - Look up target_employee's profile_id
  - Look up courses for target_program_id WHERE status = 'published'
  - INSERT course_enrollments ON CONFLICT DO NOTHING
  - send_notification to employee ('assignment')
- If approved + nudge:
  - send_notification to employee ('nudge', using display_data for message)
- Returns updated action row

**Acceptance Criteria**:
1. SECURITY DEFINER + SET search_path = public
2. Manager/admin role check
3. Approve auto_enroll → creates enrollment + notification
4. Approve nudge → creates notification
5. Skip → only status change, no side effects
6. Cannot resolve non-pending action

---

#### [x] D6: Create `generate_training_insights()` function

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_generate_training_insights.sql`

**Dependencies**: D1 (training_insights table).

**Logic** — for each group, generates:
1. **team_weekly**: count of new enrollments, completions, avg score this period
2. **employee_alert**: employees with no section_progress activity in 7+ days AND active enrollments; employees with failed quizzes
3. **course_health**: courses with pass_rate < 60% (from evaluations)
4. **milestone**: employees who completed programs/courses this period

Also creates **nudge training_actions** for each stalled employee detected (action_type='nudge', status='pending').

- Sets `period_start = CURRENT_DATE - 7, period_end = CURRENT_DATE`
- Supersedes prior insights of same type+group for overlapping period
- Returns count of insights generated

**Acceptance Criteria**:
1. SECURITY DEFINER + SET search_path = public
2. Generates at least team_weekly insight per group
3. Supersedes old insights (sets superseded_by on old rows)
4. Creates nudge actions for stalled employees
5. Idempotent (re-running supersedes and re-creates)

---

### Milestone 3: Trigger + Cron Jobs

#### [x] D7: Create `trg_auto_enroll_on_employee_link` trigger

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_auto_enroll_trigger.sql`

**Dependencies**: D4 (auto-enrollment logic).

**What**:
- Trigger function fires AFTER UPDATE ON employees
- WHEN `OLD.profile_id IS NULL AND NEW.profile_id IS NOT NULL`
- Runs auto-enrollment logic for that single employee (subset of run_auto_enrollment)
- Must be idempotent: ON CONFLICT DO NOTHING on course_enrollments
- Safe against repeated profile_id changes (NULL→X→NULL→Y)

**Acceptance Criteria**:
1. SECURITY DEFINER + SET search_path = public
2. Fires only when profile_id changes from NULL to non-NULL
3. Creates enrollments for required programs
4. Creates pending actions for optional programs
5. ON CONFLICT DO NOTHING prevents duplicates
6. Does not error on repeated updates

---

#### [x] D8: Schedule cron jobs (auto-enrollment daily, insights weekly)

**File**: `supabase/migrations/YYYYMMDDHHMMSS_schedule_phase_d_crons.sql`

**Dependencies**: D4, D6 (functions to schedule).

**Jobs**:
1. `auto-enrollment-daily`: `0 5 * * *` (5 AM UTC) — calls `expire_stale_training_actions()` then `run_auto_enrollment()`
2. `insights-weekly`: `0 6 * * 0` (6 AM UTC Sundays) — calls `generate_training_insights()`

**Pattern**: Idempotent unschedule + reschedule (same as existing cron migrations).

**Acceptance Criteria**:
1. Both jobs created successfully
2. `echo y | npx supabase db push` succeeds
3. Follows existing cron pattern

---

### Milestone 4: Edge Function Tools

#### [x] D9: Add `get_pending_actions` and `get_recent_insights` tools to training manager

**Files**:
- `supabase/migrations/YYYYMMDDHHMMSS_create_pending_actions_insights_functions.sql` (2 PG functions)
- `supabase/functions/ask/index.ts` (add 2 tools + 2 cases to switch)

**PG Functions**:
1. `get_pending_actions(p_group_id)` — returns pending training_actions with employee display info
2. `get_recent_insights(p_group_id, p_insight_type DEFAULT NULL)` — returns current (non-superseded) insights

**Edge Function Changes**:
- Add 2 tool definitions to `TRAINING_MANAGER_TOOLS` array
- Add 2 cases to `executeTrainingManagerTool` switch

**Acceptance Criteria**:
1. Both PG functions: SECURITY DEFINER + SET search_path = public, manager/admin check
2. Tools added to TRAINING_MANAGER_TOOLS (now 7 total)
3. `echo y | npx supabase db push` succeeds
4. `npx supabase functions deploy ask --no-verify-jwt` succeeds

---

### Milestone 5: Frontend Hooks

#### [x] D10: Create `useTrainingActions` hook

**File**: `src/hooks/use-training-actions.ts`

**Dependencies**: D1, D5 (table + resolve function).

**What**:
- Fetches `training_actions WHERE status = 'pending'` for user's group
- `resolveAction(actionId, resolution, note?)` calls `supabase.rpc('resolve_training_action', ...)`
- Maps `display_data` JSONB to `AISuggestion` interface fields
- Returns `{ actions, isLoading, error, resolveAction, refetch }`

**Acceptance Criteria**:
1. TypeScript compiles
2. Fetches pending actions correctly
3. resolveAction calls RPC and refetches
4. Maps display_data to AISuggestion shape

---

#### [x] D11: Create `useNotifications` hook (polling)

**File**: `src/hooks/use-notifications.ts`

**Dependencies**: D1, D3 (table + mark_read function).

**What**:
- Fetches recent notifications for `auth.uid()`, ordered by created_at DESC, limit 50
- `markRead(notificationId)` calls `supabase.rpc('mark_notification_read', ...)`
- `unreadCount` derived from `notifications.filter(n => !n.read).length`
- Returns `{ notifications, unreadCount, isLoading, markRead }`

**Acceptance Criteria**:
1. TypeScript compiles
2. Fetches user's notifications
3. markRead updates local state + calls RPC
4. unreadCount is accurate

---

#### [x] D12: Create `useTrainingInsights` hook

**File**: `src/hooks/use-training-insights.ts`

**Dependencies**: D1 (training_insights table).

**What**:
- Fetches `training_insights WHERE superseded_by IS NULL AND group_id = X`
- Ordered by severity (critical→warning→info) then created_at DESC
- Returns `{ insights, isLoading, error, refetch }`

**Acceptance Criteria**:
1. TypeScript compiles
2. Fetches current insights
3. Handles empty state

---

### Milestone 6: Notification Components

#### [x] D13: Create NotificationBell, NotificationDropdown, NotificationItem components

**Files**:
- `src/components/admin-panel/notifications/NotificationBell.tsx`
- `src/components/admin-panel/notifications/NotificationDropdown.tsx`
- `src/components/admin-panel/notifications/NotificationItem.tsx`

**Dependencies**: D11 (useNotifications hook).

**What**:
- `NotificationBell`: Bell icon with red badge (unreadCount > 0), toggles dropdown
- `NotificationDropdown`: Scrollable list, "Notifications" header, empty state
- `NotificationItem`: Unread dot, title, body, relative time, type icon, click to mark read

**Acceptance Criteria**:
1. TypeScript compiles
2. Bell shows badge when unread > 0
3. Dropdown lists notifications with correct states
4. Click marks notification as read
5. Empty state message

---

#### [x] D14: Mount NotificationBell in AdminPanelShell

**File**: `src/components/admin-panel/AdminPanelShell.tsx`

**Dependencies**: D13 (notification components).

**What**:
- Add NotificationBell to the admin panel header/tab area
- Only visible to manager/admin roles
- Does not break existing tab bar layout

**Acceptance Criteria**:
1. TypeScript compiles
2. Bell visible in admin panel header
3. Existing layout unaffected

---

### Milestone 7: Wire Suggestions to Live Data

#### [x] D15: Wire AISuggestionsCard to useTrainingActions hook

**Files**:
- `src/components/admin-panel/hub/SuggestionItem.tsx` (add onClick handlers)
- `src/components/admin-panel/hub/AISuggestionsCard.tsx` (add onAction prop)
- `src/components/admin-panel/hub/AIHubView.tsx` (replace MOCK_AI_SUGGESTIONS)

**Dependencies**: D10 (useTrainingActions hook).

**What**:
1. Add `onAction?: (actionLabel: string) => void` prop to `SuggestionItem` → wire button `onClick`
2. Add `onAction?: (suggestionId: string, actionLabel: string) => void` to `AISuggestionsCard`
3. In `AIHubView`: remove `MOCK_AI_SUGGESTIONS` import, use `useTrainingActions()` hook
4. Map `training_actions` rows to `AISuggestion[]` shape via `display_data`
5. Wire onAction: "Approve" → `resolveAction(id, 'approved')`, "Skip" → `resolveAction(id, 'skipped')`
6. Loading state, empty state ("No pending suggestions")

**Acceptance Criteria**:
1. TypeScript compiles
2. Suggestions show from live data (or empty state)
3. Approve/Skip buttons call backend and refresh list
4. Mock import removed for MOCK_AI_SUGGESTIONS

---

### Milestone 8: Add localization strings

#### [x] D16: Add Phase D localization strings

**File**: `src/components/admin-panel/strings.ts`

**Dependencies**: D13, D15 (components that need strings).

**What**: Add EN/ES keys for:
- Notification bell/dropdown: "Notifications", "Mark all read", "No notifications"
- Notification types: assignment, nudge, reminder, announcement
- Suggestion empty state: "No pending suggestions"
- Approval confirmations: "Approved", "Skipped"

**Acceptance Criteria**:
1. All new keys in both EN and ES
2. TypeScript compiles

---

## Dependency Graph

```
D1 (tables) ──┬── D2 (seed PTR)
              ├── D3 (helpers) ──┬── D4 (auto-enrollment) ──┬── D7 (trigger)
              │                  │                           ├── D8 (crons)
              │                  └── D5 (resolve action) ────┘
              ├── D6 (insights) ── D8 (crons)
              ├── D9 (edge fn tools)
              ├── D10 (useTrainingActions hook) ── D15 (wire suggestions)
              ├── D11 (useNotifications hook) ── D13 (notification UI) ── D14 (mount bell)
              └── D12 (useTrainingInsights hook)
                                                                   D16 (strings)
```

**Parallelizable groups**:
- D1 alone first (all tables)
- D2 ∥ D3 ∥ D6 ∥ D9 ∥ D10 ∥ D11 ∥ D12 (after D1)
- D4 after D2+D3
- D5 after D3
- D7 after D4
- D8 after D4+D6
- D13 after D11
- D14 after D13
- D15 after D10

---

## Security Rules

1. All PG functions: SECURITY DEFINER + SET search_path = public
2. Manager/admin role check in resolve_training_action and all query functions
3. Notifications: users see only their own (RLS: user_id = auth.uid())
4. group_id always injected server-side in edge function tools
5. Auto-enrollment runs as superuser (cron context) — no auth.uid()
6. No write operations exposed to frontend except resolve_training_action and mark_notification_read

---

## Known Limitations

1. **Other hub components still mock** — contests, growth paths, rewards, weekly update still use mock data. Phase D only wires suggestions and adds notifications.
2. **No on-demand insights** — insights generate weekly via cron. Manager can ask the AI chat for current-state analysis.
3. **No SMS/email notifications** — in-app only. Phase E.
4. **Polling, not Realtime** — can upgrade later if sb_publishable_ key works with Supabase Realtime.
5. **Only Server 101 has courses** — auto-enrollment only produces visible results for this program. Other 5 programs are coming_soon with no courses.
