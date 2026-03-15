# Phase C: AI Training Tools — Implementation Plan

Source: Master Implementation Plan (Phase C), software-architect + task-planner + devils-advocate review.

---

## Architecture Decision

**New `training_manager` domain** in the `/ask` edge function (separate from the student-facing `training` domain). Rationale: the existing `training` branch requires `section_id` + `content_context`, uses structured JSON output with `topics_update`, and is fundamentally student-facing. The manager AI has an entirely different request shape, response shape, prompt, tool set, and auth model.

## Data Flow

```
Manager types in AIAskBar → useAskTrainingManager hook
  → supabase.functions.invoke('ask', { domain: 'training_manager', question, groupId, sessionId })
  → /ask edge function:
      1. Auth (getClaims) + role check (manager/admin → 403 otherwise)
      2. Usage limits check
      3. Create/resume chat session (context_type = 'training_manager')
      4. Load chat history (last 20 messages)
      5. Load domain-training-manager prompt from ai_prompts
      6. Call OpenAI with system prompt + history + question + 5 tools
      7. Tool-use loop (max 3 rounds): AI calls get_team_training_summary, get_employee_detail, etc.
      8. Edge function executes via supabase.rpc() with p_group_id injected server-side
      9. Final answer synthesized by OpenAI
      10. Persist user + assistant messages to chat_messages
      11. Increment usage
      12. Return UnifiedAskResponse { answer, citations: [], usage, mode: 'search', sessionId }
  ← Hook appends to local message array, renders in ManagerAIChat
```

## Join Path: employees ↔ course_enrollments

The `employees` table links to `profiles` via a **nullable** `profile_id` FK. `course_enrollments` links to `profiles` via `user_id`. The join path is:

```
employees.profile_id → profiles.id = course_enrollments.user_id
```

**Critical**: `profile_id` is NULL for employees who haven't created an app account. PG functions must:
- LEFT JOIN to course_enrollments (not INNER JOIN)
- Return employee info even when profile_id is NULL (with NULL progress fields)
- The AI prompt must instruct: "If an employee has no training data, explain they haven't been linked to an app account yet."

---

## Tasks

### Milestone 1: Database Foundation

#### [x] T1: Extend CHECK constraints for `training_manager`

**File**: `supabase/migrations/YYYYMMDDHHMMSS_extend_constraints_for_training_manager.sql`

**What changes**:
1. `chat_sessions_context_type_check` — add `'training'` AND `'training_manager'` (note: `'training'` is currently missing from this constraint despite being in the edge function's VALID_CONTEXTS — fix both)
2. `ai_prompts_domain_check` — add `'training_manager'`

Current constraint values:
- `chat_sessions_context_type_check`: `'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'steps_of_service', 'forms'`
- `ai_prompts_domain_check`: `'manual', 'recipes', 'dishes', 'wines', 'cocktails', 'beer_liquor', 'steps_of_service', 'forms'`
- `ai_prompts_category_check`: `'system', 'domain', 'action', 'voice', 'teacher_mode'` (no change needed)
- `ai_prompts_domain_required`: `(category IN ('domain','action') AND domain IS NOT NULL) OR (category IN ('system','voice','teacher_mode'))` (no change needed — the new prompt uses `category='domain'` + `domain='training_manager'` which satisfies this)

**Dependencies**: None.

**Acceptance Criteria**:
1. Migration wrapped in `BEGIN; ... COMMIT;`
2. `echo y | npx supabase db push` succeeds
3. INSERT into `chat_sessions` with `context_type = 'training_manager'` does not violate constraint
4. INSERT into `ai_prompts` with `domain = 'training_manager', category = 'domain'` does not violate constraint

---

#### [x] T2: Create 5 training manager PG query functions

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_training_manager_query_functions.sql`

**Dependencies**: T1.

All functions: `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`.

**Function 1: `get_team_training_summary`**
```sql
get_team_training_summary(
  p_group_id UUID,
  p_department TEXT DEFAULT NULL,     -- 'FOH', 'BOH', 'Management'
  p_employment_status TEXT DEFAULT NULL, -- 'active', 'inactive', etc.
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  position TEXT,
  department TEXT,
  employment_status TEXT,
  hire_date DATE,
  profile_id UUID,            -- NULL if not linked
  courses_enrolled INT,
  courses_completed INT,
  avg_score INT,
  latest_activity TIMESTAMPTZ
)
```
- JOINs: `employees` LEFT JOIN (via profile_id) `course_enrollments`
- Filters by `employees.group_id = p_group_id`
- Optional filters on `employees.department` and `employees.employment_status`
- Aggregates enrollments per employee
- Returns employees even if profile_id is NULL (with 0 courses, NULL avg_score)

**Function 2: `get_employee_training_detail`**
```sql
get_employee_training_detail(
  p_group_id UUID,
  p_employee_id UUID DEFAULT NULL,    -- lookup by employees.id
  p_employee_name TEXT DEFAULT NULL    -- fuzzy lookup by name (ILIKE)
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  position TEXT,
  department TEXT,
  hire_date DATE,
  employment_status TEXT,
  profile_linked BOOLEAN,
  course_id UUID,
  course_title TEXT,
  enrollment_status TEXT,
  completion_pct NUMERIC,
  final_score INT,
  final_passed BOOLEAN,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latest_eval_score INT,
  latest_eval_competency TEXT,
  match_count INT              -- total employees matching (for disambiguation)
)
```
- If `p_employee_id` is provided: exact match on `employees.id`
- If `p_employee_name` is provided: `ILIKE '%' || p_employee_name || '%'` on `employees.first_name`, `employees.last_name`, or `employees.display_name`
- If both NULL: return empty set
- Returns ALL matching employees (AI asked to clarify if match_count > 1)
- LEFT JOIN to course_enrollments and evaluations via profile_id
- Returns `profile_linked = (profile_id IS NOT NULL)`

**Function 3: `get_course_training_analytics`**
```sql
get_course_training_analytics(
  p_group_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  course_id UUID,
  course_title TEXT,
  enrolled_count INT,
  in_progress_count INT,
  completed_count INT,
  avg_score INT,
  pass_rate NUMERIC,
  avg_completion_days NUMERIC,
  problem_sections JSONB       -- [{section_id, title, avg_quiz_score, fail_count}]
)
```
- Aggregates from `course_enrollments` WHERE `group_id = p_group_id AND course_id = p_course_id`
- Problem sections: `section_progress` grouped by section, ordered by avg quiz_score ASC, limit 5

**Function 4: `get_training_alerts`**
```sql
get_training_alerts(p_group_id UUID)
RETURNS TABLE (
  alert_type TEXT,      -- 'overdue', 'stalled', 'failed', 'deadline_approaching'
  severity TEXT,        -- 'high', 'medium', 'low'
  employee_id UUID,
  display_name TEXT,
  position TEXT,
  course_id UUID,
  course_title TEXT,
  detail TEXT,
  due_date DATE
)
```
- `overdue` (high): `course_enrollments.expires_at < now()` AND status != 'completed'
- `stalled` (medium): `course_enrollments.status = 'in_progress'` AND `updated_at < now() - INTERVAL '7 days'`
- `failed` (high): `course_enrollments.final_passed = false`
- `deadline_approaching` (medium): `expires_at` within 3 days
- Joins employees via profiles to get display_name, position

**Function 5: `get_program_completion_summary`**
```sql
get_program_completion_summary(
  p_group_id UUID,
  p_program_id UUID DEFAULT NULL
)
RETURNS TABLE (
  employee_id UUID,
  display_name TEXT,
  position TEXT,
  program_id UUID,
  program_title TEXT,
  program_status TEXT,
  total_courses INT,
  completed_courses INT,
  overall_score INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
)
```
- JOINs: `employees` → `profiles` → `program_enrollments` → `training_programs`
- When `p_program_id IS NULL`: returns all programs
- LEFT JOIN so employees without enrollments still appear

**Acceptance Criteria**:
1. All 5 functions created successfully via `echo y | npx supabase db push`
2. Each function returns correct columns when called with valid group_id
3. Functions return empty result set (not error) for invalid group_id
4. `get_employee_training_detail` returns multiple rows when name is ambiguous
5. `get_team_training_summary` returns employees with NULL profile_id (with 0 course counts)

---

#### [x] T3: Seed the training manager AI prompt

**File**: `supabase/migrations/YYYYMMDDHHMMSS_seed_training_manager_prompt.sql`

**Dependencies**: T1.

**Parallelizable with**: T2.

**What**: INSERT into `ai_prompts`:
- `slug`: `'domain-training-manager'`
- `category`: `'domain'`
- `domain`: `'training_manager'`
- `prompt_en`: Manager AI prompt (see content below)
- `prompt_es`: Spanish equivalent
- `is_active`: `true`
- `sort_order`: `10`

**Prompt Content (EN) — must include**:
- Identity: "You are the AI Training Manager for this restaurant."
- Tool declarations: list all 5 tools with descriptions
- Behavioral rules:
  - ALWAYS query data with tools before answering — never guess or fabricate
  - If employee name is ambiguous (match_count > 1), present all matches and ask to clarify
  - If an employee has no training data (profile not linked), explain this clearly
  - Format numbers clearly (percentages, scores)
  - Identify actionable items and suggest next steps
  - Can PROPOSE actions (enroll, schedule) but never execute them
  - Decline off-topic questions without making tool calls
  - Respond in the same language as the question
- Tone: professional, concise, data-driven, supportive
- Guardrails: never reveal raw data to non-managers, never fabricate employee information

**Acceptance Criteria**:
1. `echo y | npx supabase db push` succeeds
2. `SELECT * FROM ai_prompts WHERE slug = 'domain-training-manager'` returns one active row
3. Both `prompt_en` and `prompt_es` are non-empty

---

#### [x] T2.5: Verify PG functions with test queries

**Dependencies**: T2, T3.

**What**: Run verification queries against the 5 PG functions:
1. Call each function with the Alamo Prime group_id
2. Call `get_employee_training_detail` with a name that exists
3. Call `get_employee_training_detail` with NULL id and NULL name (should return empty)
4. Call `get_training_alerts` (verify it runs without error even if no alerts)
5. Call `get_team_training_summary` with department filter
6. Verify SECURITY DEFINER and search_path settings

**Acceptance Criteria**:
1. All 5 functions execute without error
2. Return types match expected schemas
3. No cross-group data leakage possible (tested with wrong group_id → empty result)

---

### Milestone 2: Edge Function Modification

#### [x] T4: Add type definitions + TRAINING_MANAGER_TOOLS array

**File**: `supabase/functions/ask/index.ts`

**Dependencies**: T2 (function names finalized).

**Parallelizable with**: T2.5 (doesn't need to wait for verification).

**What**:
1. Add `| "training_manager"` to `ContextType` union (line ~43)
2. Add `"training_manager"` to `VALID_CONTEXTS` array (line ~53)
3. Define `TRAINING_MANAGER_TOOLS` array after `SEARCH_TOOLS` (after line ~357):

```typescript
const TRAINING_MANAGER_TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "get_team_training_summary",
      description: "Get an overview of all employees and their training progress. Use for questions about team status, who's doing well, or general progress reports.",
      parameters: {
        type: "object",
        properties: {
          department: { type: "string", description: "Filter by department: FOH, BOH, or Management" },
          status: { type: "string", description: "Filter by employment status: active, inactive, terminated, on_leave" },
          limit: { type: "integer", description: "Max employees to return (default 25)" },
        },
        required: [],
      },
    },
  },
  // ... 4 more tools
];
```

**Key design rule**: Tool parameters do NOT include `group_id` — it is always injected server-side.

**Acceptance Criteria**:
1. TypeScript compiles
2. Existing behavior unaffected (no handler uses these tools yet)
3. `TRAINING_MANAGER_TOOLS` has exactly 5 entries

---

#### [x] T5: Add `handleTrainingManagerDomain()` and early branch

**File**: `supabase/functions/ask/index.ts`

**Dependencies**: T1, T2, T3, T4 (all database + type definitions).

**What**:
1. Add `executeTrainingManagerTool()` dispatcher:
   - Receives tool name + args + groupId
   - Always injects `p_group_id` (never trusts AI's args)
   - Calls `supabase.rpc(toolName, { p_group_id: groupId, ...parsedArgs })`
   - Formats result as compact text for AI consumption
2. Add `handleTrainingManagerDomain()`:
   - Role check: query `group_memberships` for manager/admin role → 403 if not
   - Usage check via `get_user_usage` RPC
   - Session management: `get_or_create_chat_session` with `context_type: 'training_manager'`
   - Load chat history via `get_chat_history`
   - Load prompt via `fetchPromptBySlug('domain-training-manager', language)`
   - Build OpenAI messages: system prompt + history + user question
   - Tool-use loop: max 3 rounds with `TRAINING_MANAGER_TOOLS`
   - Persist user + assistant messages to `chat_messages`
   - Increment usage via `increment_usage`
   - Return `UnifiedAskResponse`
3. Add early branch after training domain branch (~line 1284):
   ```typescript
   if (domain === 'training_manager') {
     // ... validate, call handler, return
   }
   ```

**Acceptance Criteria**:
1. Deploy succeeds: `npx supabase functions deploy ask --no-verify-jwt`
2. Request with `domain: 'training_manager'` from manager user returns valid response
3. Request from staff user returns 403
4. Usage is checked and incremented
5. Session is created and reused across requests
6. All existing domains still work correctly
7. Off-topic questions are handled by the prompt (no tool calls wasted)

---

### Milestone 3: Frontend

#### [x] T6: Create `useAskTrainingManager` hook

**File**: `src/hooks/use-ask-training-manager.ts`

**Dependencies**: T5.

**What**: Multi-turn conversation hook:
- State: `messages: {role, content, timestamp}[]`, `sessionId`, `isLoading`, `error`
- `sendMessage(question)`: calls edge function, appends user + AI messages
- `clearConversation()`: resets state
- Uses `useAuth` for auth, `useLanguage` for language
- Role check: if not manager/admin, show toast and return
- Handles error responses (limit_exceeded, forbidden)

**Acceptance Criteria**:
1. TypeScript compiles
2. Hook manages conversation state correctly
3. sessionId is passed on subsequent calls
4. Error states are handled with toast messages

---

#### [x] T7: Create `ManagerAIChat` component (parallelizable with T8)

**File**: `src/components/admin-panel/hub/ManagerAIChat.tsx`

**Dependencies**: T6 (for Message type).

**What**:
- Props: `messages`, `isLoading`, `language`
- Renders chat thread: user messages right, AI messages left
- AI messages render markdown (bold, lists, tables)
- Loading indicator (typing dots) when isLoading
- Auto-scroll to latest message
- Empty state welcome message
- Mobile-responsive

**Acceptance Criteria**:
1. TypeScript compiles
2. Renders messages correctly
3. Auto-scrolls on new messages
4. Shows loading indicator
5. Shows empty state when no messages

---

#### [x] T8: Wire `AIAskBar` to hook (parallelizable with T7)

**File**: `src/components/admin-panel/hub/AIAskBar.tsx` (modify existing)

**Dependencies**: T6.

**What**:
- Remove `readOnly` from input
- Add props: `onSubmit: (question: string) => void`, `isLoading: boolean`
- Controlled input with local state
- Form submission on Enter or button click
- Disable during loading
- Loading spinner on button

**Acceptance Criteria**:
1. TypeScript compiles
2. Input accepts text and submits on Enter/click
3. Disabled during loading
4. Clears input after submit

---

#### [x] T9: Create `useEvaluationsDashboard` hook (parallelizable with T6-T8)

**File**: `src/hooks/use-evaluations-dashboard.ts`

**Dependencies**: None (evaluations table already exists).

**What**:
- Queries `evaluations` table via Supabase client
- Joins `profiles` (user name) and `courses` (course title)
- Scoped to user's group via `group_id`
- Filters: `superseded_by IS NULL` (only current evaluations)
- Optional filters: courseId, evalType
- Returns `{ evaluations, isLoading, error, refetch }`
- Ordered by `created_at DESC`, limit 20

**Note**: The evaluations table may currently be empty. The dashboard must handle this gracefully with a clear empty state ("No evaluations yet — evaluations will appear here as employees complete training assessments.").

**Acceptance Criteria**:
1. TypeScript compiles
2. Returns evaluations (or empty array) correctly
3. Handles empty state
4. Filters work correctly

---

#### [x] T10: Create `EvaluationCard` component (parallelizable with T9)

**File**: `src/components/admin-panel/hub/EvaluationCard.tsx`

**Dependencies**: T9 (for Evaluation type).

**What**:
- Renders single evaluation: employee name, course, eval_type badge, score (color-coded), competency badge, passed/failed, relative time
- student_feedback.strengths as green chips, areas_for_improvement as amber chips
- Consistent admin panel card styling

**Acceptance Criteria**:
1. TypeScript compiles
2. Renders all evaluation fields
3. Score color-coding works (green >=80, yellow >=60, red <60)

---

#### [x] T11: Create `EvaluationsDashboard` component

**File**: `src/components/admin-panel/hub/EvaluationsDashboard.tsx`

**Dependencies**: T9, T10.

**What**:
- Uses `useEvaluationsDashboard` hook
- Section header: "AI Feedback" / "Retroalimentación IA"
- Filter row (eval_type dropdown)
- List of EvaluationCard components
- Loading skeleton, empty state, error state with retry

**Acceptance Criteria**:
1. TypeScript compiles
2. Renders evaluations list
3. Empty state message is clear and helpful
4. Filters work

---

#### [x] T12: Wire everything into `AIHubView`

**File**: `src/components/admin-panel/hub/AIHubView.tsx` (modify existing)

**Dependencies**: T6, T7, T8, T11.

**What**:
- Import and use `useAskTrainingManager` hook
- Add `ManagerAIChat` between the two-column grid and `AIAskBar`
- Wire `AIAskBar` with `onSubmit` and `isLoading` from hook
- Add `EvaluationsDashboard` section after `AIAskBar`
- Layout order: Hero → WeeklyUpdate → Grid → **ManagerAIChat** → **AIAskBar** → **EvaluationsDashboard** → WeeklyUpdateOverlay

**Acceptance Criteria**:
1. TypeScript compiles
2. Page renders without crashes
3. Manager can type and receive AI responses
4. Evaluations section shows below the chat
5. All props correctly passed

---

#### [x] T13: Add localization strings

**File**: `src/components/admin-panel/strings.ts` (modify existing)

**Dependencies**: T7, T10, T11 (need to know what strings are needed).

**Note**: Can be done incrementally during T7/T10/T11 implementation rather than as a separate final task.

**What**: Add EN/ES keys for:
- Chat welcome/empty state
- "AI Feedback" section title
- Evaluation card labels (score, competency, passed, failed, strengths, areas for improvement)
- Loading/empty/error state messages
- Filter labels

**Acceptance Criteria**:
1. No missing keys between EN and ES
2. TypeScript compiles

---

## Dependency Graph

```
T1 (constraints) ──┬── T2 (PG functions) ── T2.5 (verify) ──┐
                    │                                          │
                    └── T3 (seed prompt) ─────────────────────┤
                                                               │
                    T4 (type defs + tools) ────────────────────┤
                                                               │
                                                               ▼
                                                         T5 (edge fn handler)
                                                               │
                                                               ▼
                                                         T6 (hook)
                                                          │      │
                                                ┌─────────┘      └─────────┐
                                                ▼                           ▼
                                          T7 (chat UI)               T8 (wire bar)
                                                │                           │
                                                │         T9 (eval hook) ───┤
                                                │              │            │
                                                │              ▼            │
                                                │         T10 (eval card)   │
                                                │              │            │
                                                │              ▼            │
                                                │         T11 (eval dash)   │
                                                │              │            │
                                                ▼              ▼            ▼
                                          T12 (wire AIHubView) ◄────────────┘
                                                │
                                                ▼
                                          T13 (strings)
```

**Parallelizable groups**:
- T2 ∥ T3 (both depend only on T1)
- T4 can start as soon as T2's function names are decided
- T7 ∥ T8 (both depend on T6 but not each other)
- T9 ∥ T10 can start in parallel with T6-T8 (T9 depends only on existing evaluations table)

---

## Security Rules

1. **p_group_id always injected server-side** — never trusted from AI tool call arguments
2. **Role gating in edge function** — manager/admin only, checked before any tool execution
3. **PG functions are SECURITY DEFINER** — called via service role client (bypasses RLS)
4. **No write operations** in any PG function — all read-only
5. **AI is advisory only** — can propose actions but never execute them
6. **Evaluations dashboard uses RLS** — Supabase client with anon key, "Managers can view group evaluations" policy enforces access

---

## Known Limitations

1. **Other AI Hub components still use mock data** — WeeklyUpdateCard, AISuggestionsCard, ActiveContestsCard, GrowthPathsCard, WhatsNextTimeline, RewardBankCard all import from `@/data/mock-admin-panel`. Phase C only wires the AIAskBar and adds the EvaluationsDashboard.

2. **Evaluations table may be empty** — The evaluations table was recreated in the Assessment Framework phase but may not have data yet. The dashboard must show a clear empty state.

3. **Conversation is client-side** — The hook maintains messages in React state. On page refresh, the conversation is lost (but the session persists in the DB, so history can be restored in a future enhancement).

4. **The /ask edge function will grow to ~2200+ lines** — Extracting the training_manager handler into a separate module file is desirable but not blocking.
