# Training System — Master Implementation Plan

Source: 4 Opus agent audits of current codebase + Juan's 7-point requirements.

---

## Current State (What Exists Today)

**Database**: 14 training tables live (post-Course Builder rebuild). Courses, sections, enrollments, progress, quizzes, conversations, programs — all group-scoped. But no employee position tracking, no hire dates, no evaluations table (dropped in rebuild), no rollouts (placeholder for Phase 8).

**Users**: 3 roles (`staff`, `manager`, `admin`) — these are access-control roles, NOT restaurant positions. Single group ("Alamo Prime") with flat architecture. `group_memberships` is many-to-many in schema but every consumer uses `LIMIT 1` — multi-group is technically possible but practically broken.

**AI**: 26 edge functions deployed. `/ask` is unified across 8 domains including training. 4-layer prompt system (rules, persona, mode, content). Course builder uses Claude, everything else uses OpenAI. Usage metering + credit pipeline in place.

**Frontend**: 30+ routes. `ProtectedRoute` supports role arrays. `RoleGate` component exists but is unused. `/admin/training` is referenced but the route doesn't exist. Product tables and manual_sections have NO `group_id` — they're single-tenant.

---

## The 7 Requirements

### 1. Employee Ingestion (Hourlies)
### 2. Wiring the Admin Dashboard Data
### 3. Training Database for AI Interaction
### 4. Multi-Unit Architecture
### 5. AI Training Manager
### 6. Direct Communication with Hourlies (Texting)
### 7. Role-Based Page Access

---

## Requirement 1: Employee Ingestion

**Problem**: The system has `profiles` (auth users) and `group_memberships` (role = staff/manager/admin), but no concept of restaurant **position** (Server, Line Cook, Bartender, etc.), **hire date**, **employment status**, or **employee metadata**.

**What's Needed**: A way to register and track restaurant employees with their real-world job data, independent from their app login.

### Proposed: `employees` Table

```
employees
├── id (UUID PK)
├── group_id (FK → groups) — which restaurant/unit
├── unit_id (FK → units, nullable) — which location (Req #4)
├── profile_id (FK → profiles, nullable) — linked app account (NULL = not yet onboarded)
│
├── first_name, last_name
├── display_name (computed or manual)
├── email (nullable — not all hourlies have one)
├── phone (nullable — for text communication, Req #6)
├── phone_consent (boolean — legal opt-in for texting)
├── phone_consent_at (timestamp)
│
├── position (enum or text)
│   → line_cook, prep, dish, server, bartender, busser, barback,
│     host, food_runner, expo, manager, regional, executive
├── department (computed from position: FOH/BOH/Management)
├── employment_type (full_time, part_time, seasonal)
├── employment_status (active, inactive, terminated, on_leave)
│
├── hire_date (date — critical for tenure-based training)
├── termination_date (date, nullable)
│
├── pay_type (hourly, salary)
├── notes (text — manager notes, nullable)
│
├── created_at, updated_at
├── created_by (FK → profiles — who added them)
```

### Position Enum

```
line_cook | prep_cook | dishwasher | server | bartender | busser |
barback | host | food_runner | expo | manager | agm | gm |
regional | executive
```

These map to **departments**:
- **BOH**: line_cook, prep_cook, dishwasher, expo
- **FOH**: server, bartender, busser, barback, host, food_runner
- **Management**: manager, agm, gm, regional, executive

### `position_training_requirements` Table

Links positions to required training programs:

```
position_training_requirements
├── id (UUID PK)
├── group_id (FK → groups)
├── position (text — matches employee.position)
├── program_id (FK → training_programs)
├── required (boolean — mandatory vs recommended)
├── due_within_days (integer — e.g., 30 = must complete within 30 days of hire)
├── sort_order
```

This enables the AI to auto-assign: "Alejandra is a Server hired 3 days ago → auto-enroll in Server 101 (due in 30 days)."

### Onboarding Flow

Two paths:

**Path A — Manager adds employee first (pre-onboarding)**:
1. Manager creates `employees` row via admin panel (name, position, hire_date, phone)
2. `profile_id` stays NULL
3. Manager shares join link or texts onboarding instructions
4. Employee signs up → `join_group_by_slug` fires → profile created
5. System matches `employees.email` or `employees.phone` to new profile → auto-links `profile_id`
6. Auto-enrolls in required programs based on position

**Path B — Employee self-registers (current flow)**:
1. Employee visits `/join/alamo-prime`, signs up
2. Profile + membership created as today
3. Manager later links them to an `employees` row (or system prompts manager to complete their record)

### Key Design Decision

`employees` is the **HR record**. `profiles` is the **app account**. They are linked via `profile_id` FK but independent. This means:
- You can have employees who haven't signed up yet (phone roster)
- You can have app users who aren't linked to an employee record (edge case)
- The training system queries against `employees` (position, tenure) not just `profiles`

---

## Requirement 2: Wiring Admin Dashboard Data

**Problem**: The mockup dashboard shows rich data (KPIs, per-course stats, employee activity, grades, AI feedback) but none of this has data hooks, queries, or aggregation logic.

### Data Queries Needed

**Global KPI Strip** (across all courses in group):
```sql
-- Total Enrolled: count distinct users with active enrollments
-- Completion Rate: completed / total enrollments
-- Avg Grade: avg(final_score) where final_score IS NOT NULL
-- Pass Rate: count(final_passed = true) / count(final_score IS NOT NULL)
```

**Per-Course Stats** (left panel cards):
```sql
-- Per course: enrolled count, completed count, completion %, module count
-- From: course_enrollments JOIN courses
-- Grouped by: course_id
```

**Employees Tab** (right panel, per selected course):
```sql
-- Recent activity: section_progress JOIN employees JOIN course_enrollments
-- Shows: name, position, last module touched, time ago, score, grade
-- Sorted by: updated_at DESC
```

**Enrolled Tab**:
```sql
-- All enrollments for selected course, grouped by position (not role)
-- JOIN employees for position data
```

**Completed Tab**:
```sql
-- course_enrollments WHERE status = 'completed', sorted by completed_at DESC
-- Plus: incomplete enrollments at bottom with module counts
-- Chart data: GROUP BY DATE(completed_at)
```

**Grades Tab**:
```sql
-- Grade distribution: CASE WHEN final_score >= 90 THEN 'A' ... END
-- Per-module averages: section_progress GROUP BY section_id
-- Grade table: enrollments with scores
```

**AI Feedback Tab**:
```sql
-- Requires evaluations table (currently DROPPED — needs rebuild)
-- Course-level AI summary: generated on-demand or cached
-- Per-employee coaching notes: from evaluations.student_feedback / manager_feedback
```

### Proposed: `get_course_dashboard_data()` PG Function

A single RPC that returns all data for a selected course in one call:

```sql
CREATE FUNCTION get_course_dashboard_data(p_group_id UUID, p_course_id UUID)
RETURNS JSONB AS $$
  -- Returns: { kpis, employees, enrollments, grades, completions }
$$;
```

Plus `get_training_kpis(p_group_id)` for the global strip.

### Evaluations Table — Needs Rebuild

The original `evaluations` table was dropped in the Course Builder rebuild. It needs to come back for the AI Feedback tab:

```
evaluations (rebuild)
├── id, user_id, enrollment_id, section_id, course_id
├── eval_type (session, quiz, course_final)
├── student_feedback (JSONB — visible to employee)
├── manager_feedback (JSONB — manager-only)
├── competency_level (novice, competent, proficient, expert)
├── ai_generated (boolean)
├── created_at
```

---

## Requirement 3: Training Database for AI Interaction

**Problem**: We need AI to be able to query training data — employee progress, quiz results, evaluations — and provide intelligent responses to managers ("Who's behind on Server 101?", "How's the new hire class doing?").

### Approach: Tool-Use Functions for the AI

The `/ask` edge function already supports a 3-round tool-use loop with 7 search tools. We add **training-specific tools** that the AI can call:

```
New AI Tools (OpenAI function-calling):
├── get_team_progress(group_id, filters?)
│   → Returns all employees + enrollment status + scores
│
├── get_employee_detail(employee_id)
│   → Returns full training history, quiz scores, evaluations
│
├── get_course_analytics(course_id)
│   → Returns enrollment stats, grade distribution, problem modules
│
├── get_training_alerts(group_id)
│   → Returns overdue enrollments, stuck employees, expiring deadlines
│
├── get_program_completion(group_id, program_id?)
│   → Returns program-level progress per employee
```

These tools are PG functions (SECURITY DEFINER, group-scoped) that the edge function calls via `supabase.rpc()` when the AI decides it needs data.

### New Prompt: `domain-training-manager`

A new AI prompt for the manager-facing training context:

```
You are a training operations assistant for restaurant managers.
You can query employee training data, identify who needs attention,
suggest actions, and generate reports.

When the manager asks about employees, use the training tools to
get real data before responding. Never guess — always query first.
```

This is a new mode in the `/ask` edge function's training branch — differentiated from the student-facing teach/practice mode by the user's role (managers get the manager AI, staff get the tutor AI).

---

## Requirement 4: Multi-Unit Architecture

**Problem**: The system is single-tenant (one group = one restaurant). We need multiple units under one concept (brand), each with their own employees, potentially their own recipes, but sharing programs and courses.

### Current State

- `groups` table is flat — no hierarchy
- Product tables (recipes, wines, etc.) have NO `group_id` — globally shared
- `manual_sections` has NO `group_id` — globally shared
- Training tables DO have `group_id`
- `get_user_group_id()` uses `LIMIT 1` — breaks with multi-group

### Proposed Architecture: Brand → Units

```
brands (new table)
├── id (UUID PK)
├── name ("Alamo Prime")
├── slug ("alamo-prime")
├── logo_url, settings JSONB
├── created_at

units (new table)
├── id (UUID PK)
├── brand_id (FK → brands)
├── name ("Downtown", "Stone Oak", "The Rim")
├── slug ("downtown")
├── address, phone
├── timezone
├── is_active
├── created_at
```

### Migration Path for `groups`

The existing `groups` table becomes `brands`. The concept of a "unit" (location) gets its own table. This is a rename + extension, not a tear-down:

```
groups (rename to brands)
  └── New: units table (child of brands)
        └── employees.unit_id (nullable — some are brand-level)
        └── group_memberships → add unit_id (nullable)
```

### What's Scoped Where

| Data | Scope | Rationale |
|------|-------|-----------|
| **Training programs** | Brand | Server 101 is the same across all locations |
| **Courses** | Brand | Course content doesn't change per unit |
| **Course enrollments** | Unit (via employee) | "Who at Downtown completed Server 101?" |
| **Employees** | Unit | Each location has its own staff |
| **Recipes** | Brand OR Unit | Core recipes shared; specials may be per-unit |
| **Manual sections** | Brand | Operations manual is brand-wide |
| **AI prompts** | Brand | Same AI behavior across units |
| **Evaluations** | Unit (via employee) | Performance is per-location |
| **Product tables** | Brand (add group_id) | Eventually per-unit for specials |

### The `group_id` Problem

Every existing table that has `group_id` today maps to the brand level. When we add units, we need to decide per-table whether to add `unit_id` or keep brand-level. The key principle:

> **Content is brand-level. People are unit-level.**

Training programs, courses, recipes, manual = brand.
Employees, enrollments, evaluations, conversations = unit.

### `get_user_group_id()` Fix

Replace `LIMIT 1` with an **active-unit context**:

```sql
CREATE FUNCTION get_user_active_unit_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.active_unit_id', true)::uuid,
    (SELECT unit_id FROM employees WHERE profile_id = auth.uid() LIMIT 1)
  );
$$;
```

The frontend sets the active unit via a unit switcher (for multi-unit managers/regionals). Single-unit employees auto-resolve to their one unit.

---

## Requirement 5: AI Training Manager

**Problem**: The AI should run the training program with minimal manager input — auto-assign courses based on tenure, create contests, surface insights, let managers approve or adjust.

### Components

**5A. Auto-Assignment Engine** (PG function + cron):

```sql
-- Runs daily via pg_cron
-- For each active employee:
--   1. Calculate tenure from hire_date
--   2. Look up position_training_requirements for their position
--   3. Check if already enrolled
--   4. Auto-enroll if missing and within due_within_days window
--   5. Log action to ai_training_actions table
```

**5B. Training Insights Generator** (edge function, scheduled):

```sql
-- Runs weekly (or on-demand via AI tool)
-- Per course: identifies struggling employees, overdue enrollments,
--   knowledge gaps (low-scoring modules), top performers
-- Stores insights in training_insights table
-- Manager sees these in the AI Feedback tab
```

**5C. Contest/Incentive System** (future phase):

```
training_contests
├── id, group_id, unit_id (nullable)
├── title, description
├── contest_type (knowledge_challenge, completion_race, score_improvement)
├── target_program_id or target_course_id
├── reward_type (no_sidework, free_meal, section_choice, schedule_pick)
├── reward_quantity (e.g., 3 passes)
├── status (draft, proposed, approved, active, completed)
├── proposed_by (AI or manager)
├── approved_by (manager, nullable — NULL if AI-proposed, awaiting approval)
├── starts_at, ends_at
├── created_at
```

The AI proposes contests. Managers approve with one tap. Results auto-calculated from training data.

**5D. Manager AI Chat** (extension of `/ask` training domain):

The existing `/ask` training branch gets a new mode: `training_manager`. When a manager (role check) asks about training, the AI:
- Has access to all training query tools (Req #3)
- Can propose actions ("Enroll Jose in Wine 201", "Schedule upselling workshop")
- Manager confirms → action executes
- Conversation stored in `course_conversations` with `mode = 'manager_ai'`

---

## Requirement 6: Direct Communication with Hourlies (Texting)

**Problem**: Managers need to reach employees directly — nudge someone who's behind, announce a contest, share a resource. Text/SMS is the natural channel for hourly workers.

### Legal Considerations

- **TCPA (US)**: Requires prior express consent for non-emergency texts. Must offer opt-out.
- **State laws**: Some states (CA, IL, WA) have stricter rules.
- **Employer-employee**: Work-related texts generally ok with consent, but must be during reasonable hours.
- **Best practice**: Written opt-in at hire, clear opt-out mechanism, no marketing — only operational training communications.

### Database Support (already in Req #1)

```
employees.phone (text, nullable)
employees.phone_consent (boolean, default false)
employees.phone_consent_at (timestamp, nullable)
```

### Implementation Approach

**Phase 1**: In-app notifications only (no external texting)
- Push notification to employee's app when "Nudge" is clicked
- Requires service worker / push subscription (PWA pattern)

**Phase 2**: SMS via Twilio (or similar)
- Edge function: `send-sms`
- Templates: "Nudge" (training reminder), "Contest" (announcement), "Resource" (link share)
- Consent check before every send
- Audit log: `sms_log` table (who, when, what, delivered?)
- Opt-out handling: reply STOP → auto-update `phone_consent = false`

**Phase 3**: Two-way texting
- Twilio webhook → edge function for incoming messages
- Manager sees conversation thread in admin panel
- AI can auto-respond to simple questions ("When is my training due?")

### Admin Panel Integration

The "Nudge" button in the Completed tab and AI Feedback tab triggers:
1. Check `employee.phone_consent`
2. If yes → send templated SMS
3. If no → show in-app notification only
4. Log action either way

---

## Requirement 7: Role-Based Page Access

**Problem**: Different user types need different app experiences. A Server shouldn't see BOH recipes. A Regional should see all units. A Line Cook doesn't need the wine list.

### Current State

- 3 roles: `staff`, `manager`, `admin`
- `ProtectedRoute` supports role arrays
- `RoleGate` exists but is unused
- Sidebar groups have `adminOnly: boolean` — no granular control

### Proposed: Position-Based Page Visibility

Rather than expanding the role enum (which is access-control), use the **employee position** to determine content visibility:

```typescript
// nav-config.ts
type NavVisibility = {
  positions?: Position[];     // Show to these positions (empty = all)
  departments?: Department[]; // Show to these departments
  roles?: UserRole[];         // Show to these roles
  minRole?: UserRole;         // Minimum role level
};

// Example:
{
  id: 'boh',
  label: 'BOH',
  visibility: { departments: ['BOH', 'Management'] },
  items: [
    { path: '/recipes', visibility: { departments: ['BOH', 'Management'] } },
  ]
},
{
  id: 'foh',
  label: 'FOH',
  visibility: { departments: ['FOH', 'Management'] },
  items: [
    { path: '/wines', visibility: { departments: ['FOH', 'Management'] } },
    { path: '/cocktails', visibility: { departments: ['FOH', 'Management'] } },
  ]
}
```

### Access Matrix

| Page | BOH | FOH | Management | Regional | Executive |
|------|-----|-----|------------|----------|-----------|
| Manual | All | All | All | All | All |
| Ask AI | All | All | All | All | All |
| Recipes | Yes | No | Yes | Yes | Yes |
| Dish Guide | No | Yes | Yes | Yes | Yes |
| Wines | No | Yes | Yes | Yes | Yes |
| Cocktails | No | Yes | Yes | Yes | Yes |
| Beer & Liquor | No | Yes | Yes | Yes | Yes |
| FOH Manuals | No | Yes | Yes | Yes | Yes |
| Courses | Own | Own | All | All units | All units |
| Forms | Own | Own | All | All units | All units |
| Admin Panel | No | No | Yes | Yes | Yes |
| Training Dashboard | No | No | Yes | Yes | Yes |
| Unit Switcher | No | No | If multi-unit | Yes | Yes |

### Implementation

1. **`usePageAccess()` hook**: Reads employee position + role → returns which pages are visible
2. **Sidebar filters**: `getVisibleGroups()` uses position + role instead of just `isAdmin`
3. **Route protection**: `ProtectedRoute` extended to accept `positions` and `departments`
4. **`RoleGate` activated**: Used for in-page conditional sections

---

## Implementation Phases

### Phase A: Foundation (Database + Multi-Unit)

**Must be done first — everything else depends on it.**

1. Create `brands` concept (may rename or extend `groups`)
2. Create `units` table
3. Create `employees` table with position, hire_date, phone fields
4. Create `position_training_requirements` table
5. Rebuild `evaluations` table
6. Fix `get_user_group_id()` → support active unit context
7. Add `group_id` to product tables + manual_sections (multi-tenant prep)

### Phase B: Admin Dashboard (Wiring the UI)

**Depends on Phase A for employee data.**

1. Create PG functions: `get_training_kpis()`, `get_course_dashboard_data()`
2. Create React page at `/admin/training` + route
3. Build dashboard components matching the v2 mockup
4. Wire all 5 tabs with real data hooks
5. Employee management page (`/admin/employees`) — CRUD for employees

### Phase C: AI Training Tools

**Depends on Phase A + B for data to query.**

1. Create PG query functions for AI tools
2. Add training tools to `/ask` edge function
3. Create `domain-training-manager` prompt
4. Wire manager AI mode (role-gated)
5. Build AI Feedback tab content (evaluations + insights)

### Phase D: Auto-Assignment + Insights

**Depends on Phase A + C.**

1. Build auto-enrollment engine (PG function + cron)
2. Build training insights generator (edge function)
3. Wire "Nudge" buttons to in-app notifications
4. Manager approval flow for AI suggestions

### Phase E: Role-Based Access + Communication

**Can partially parallel with Phase B+C.**

1. Implement position-based nav visibility
2. Activate `RoleGate` across pages
3. Build unit switcher for multi-unit managers
4. SMS integration (Twilio) — requires legal review first
5. Contest/incentive system (future)

---

## Critical Architecture Decisions Needed

| Decision | Options | Recommendation |
|----------|---------|----------------|
| **Rename `groups` → `brands`?** | Rename vs. add `brands` above groups | Add `brands` above — less migration risk. Groups become units. |
| **Position: enum or text?** | PG enum vs. text with CHECK | Text with CHECK — easier to add positions later without migration |
| **Product tables: add `group_id` now or later?** | Now vs. Phase E | Now (Phase A) — avoids painful migration later |
| **Employee-profile link: required or optional?** | Required (must have app account) vs. optional | Optional — allows phone-only employees, pre-onboarding roster |
| **AI model for training manager** | OpenAI GPT-5.2 vs. Claude | GPT-5.2 — consistent with existing `/ask` function |
| **SMS provider** | Twilio vs. MessageBird vs. AWS SNS | Twilio — best docs, easiest Deno integration, compliant |

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Multi-unit migration breaks existing single-tenant data | High | Seed default unit for Alamo Prime; backfill all existing records |
| `LIMIT 1` in 18+ RLS policies | High | Active-unit context via `SET LOCAL` in edge functions |
| Employee table duplicates profile data | Medium | Clear separation: employee = HR record, profile = app account |
| SMS legal liability | Medium | Legal review before Phase E; consent-first design |
| AI hallucinating training data | Medium | Tool-use only (AI must call functions, never guess); validate responses |
| Product tables gaining `group_id` breaks existing queries | Medium | Default all existing rows to Alamo Prime group_id; update queries |
