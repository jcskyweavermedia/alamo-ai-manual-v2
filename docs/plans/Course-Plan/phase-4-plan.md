# Phase 4: Management — Dashboard, Rollouts, Content Detection

> Manager dashboard, rollout system, team insights, content change detection.
> **Goal**: Managers can see team progress, create training rollouts, get AI insights, and detect content changes.

---

## Prerequisites (Already Complete)

These exist from Phase 1/3 migrations and must NOT be recreated:

| Asset | Status |
|-------|--------|
| `rollouts` table (5 statuses, RLS 4 policies, 3 indexes, trigger) | Created, empty |
| `rollout_assignments` table (4 statuses, RLS 6 policies, 2 indexes) | Created, empty |
| `content_change_log` table (RLS 3 policies, 2 indexes, UNIQUE constraint) | Created, empty |
| `evaluations` table (RLS 5 policies, 4 indexes, dual JSONB feedback) | Created, populated by Phase 3 |
| `get_user_group_id()` / `get_user_role()` helper functions | Created |
| `cleanup_expired_training_data()` scheduled cleanup function | Created |
| `course_enrollments` with `completed_sections`, `final_score`, `final_passed` | Created, populated |
| `section_progress` with `quiz_score`, `quiz_passed`, `quiz_attempts` | Created, populated |
| `quiz_attempts` + `quiz_attempt_answers` tables | Created, populated |
| `ProtectedRoute` component with `requiredRole` prop | Created |
| `RoleGate` component with `allowedRoles` prop | Created |
| `useAuth()` hook with `isManager`, `isAdmin`, `hasRole()` | Created |
| `evaluations.manager_feedback` JSONB + `manager_notes` TEXT columns | Created |
| `profiles` table with `full_name`, `email`, `avatar_url`, `is_active` | Created |
| `group_memberships` table with `role` (staff/manager/admin) | Created |
| `course-evaluate` edge function (grade_mc, grade_voice, section_evaluation) | Deployed v2 |

---

## Step-by-Step Implementation Order

### Step 4.1 — TypeScript Types for Management

**File**: `src/types/dashboard.ts` (NEW, ~220 lines)

```typescript
// ─── TEAM MEMBER PROGRESS ──────────────────────────────────────

export type TeamMemberStatus = 'on_track' | 'behind' | 'inactive';

export interface TeamMemberProgress {
  userId: string;
  fullName: string | null;
  email: string;
  role: 'staff' | 'manager' | 'admin';
  avatarUrl: string | null;
  coursesCompleted: number;
  coursesTotal: number;
  overallProgressPercent: number;
  averageQuizScore: number | null;
  competencyLevel: 'novice' | 'competent' | 'proficient' | 'expert' | null;
  lastActiveAt: string | null;
  failedSections: string[];
  status: TeamMemberStatus;
}

// ─── COURSE STATS ──────────────────────────────────────────────

export interface CourseStats {
  courseId: string;
  courseTitle: string;
  enrolledCount: number;
  completedCount: number;
  averageScore: number | null;
  completionPercent: number;
}

// ─── DASHBOARD SUMMARY ────────────────────────────────────────

export interface DashboardSummary {
  totalStaff: number;
  activeStaff: number;
  teamAverage: number;
  coursesPublished: number;
  overdueTasks: number;
}

// ─── ROLLOUT TYPES ─────────────────────────────────────────────

export type RolloutStatus = 'draft' | 'active' | 'completed' | 'expired' | 'archived';
export type AssignmentStatus = 'assigned' | 'in_progress' | 'completed' | 'overdue';

export interface RolloutRaw {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  course_ids: string[];
  section_ids: string[];
  starts_at: string;
  deadline: string | null;
  expires_at: string | null;
  status: RolloutStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Rollout {
  id: string;
  groupId: string;
  name: string;
  description: string | null;
  courseIds: string[];
  sectionIds: string[];
  startsAt: string;
  deadline: string | null;
  expiresAt: string | null;
  status: RolloutStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolloutWithProgress extends Rollout {
  totalAssignees: number;
  completedAssignees: number;
  overdueAssignees: number;
  progressPercent: number;
}

export interface RolloutAssignmentRaw {
  id: string;
  rollout_id: string;
  user_id: string;
  status: AssignmentStatus;
  started_at: string | null;
  completed_at: string | null;
  total_courses: number;
  completed_courses: number;
  created_at: string;
  updated_at: string;
}

export interface RolloutAssignment {
  id: string;
  rolloutId: string;
  userId: string;
  status: AssignmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalCourses: number;
  completedCourses: number;
  createdAt: string;
  updatedAt: string;
}

// ─── CONTENT CHANGE TYPES ──────────────────────────────────────

export interface ContentChangeRow {
  section_id: string;
  section_title: string;
  source_table: string;
  source_id: string;
  old_hash: string;
  new_hash: string;
}

export interface ContentChangeWithContext {
  sectionId: string;
  sectionTitle: string;
  sourceTable: string;
  sourceId: string;
  oldHash: string;
  newHash: string;
  affectedStudents: number;
}

// ─── EVALUATION MANAGER VIEW ───────────────────────────────────

export interface EvaluationManagerView {
  id: string;
  userId: string;
  userName: string;
  sectionTitle: string;
  evalType: 'session' | 'quiz' | 'course_final';
  competencyLevel: string | null;
  managerFeedback: {
    competencyGaps: string[];
    recommendedActions: string[];
    riskLevel: string;
  };
  managerNotes: string | null;
  createdAt: string;
}

// ─── TRANSFORM FUNCTIONS ───────────────────────────────────────

export function transformRollout(raw: RolloutRaw): Rollout {
  return {
    id: raw.id,
    groupId: raw.group_id,
    name: raw.name,
    description: raw.description,
    courseIds: raw.course_ids,
    sectionIds: raw.section_ids,
    startsAt: raw.starts_at,
    deadline: raw.deadline,
    expiresAt: raw.expires_at,
    status: raw.status,
    createdBy: raw.created_by,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export function transformAssignment(raw: RolloutAssignmentRaw): RolloutAssignment {
  return {
    id: raw.id,
    rolloutId: raw.rollout_id,
    userId: raw.user_id,
    status: raw.status,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
    totalCourses: raw.total_courses,
    completedCourses: raw.completed_courses,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
```

---

### Step 4.2 — Database Migration: Management Functions

**File**: `supabase/migrations/YYYYMMDDHHMMSS_management_functions.sql` (NEW)

This single migration creates 3 server-side functions. All use `SECURITY DEFINER SET search_path = public`.

#### 4.2a. `detect_content_changes()` — Content Hash Scanner

Scans all content source tables via per-table CASE logic using **actual column names** from each table. Does NOT use dynamic SQL because each product table has different column structures.

```sql
CREATE OR REPLACE FUNCTION detect_content_changes(p_group_id UUID)
RETURNS TABLE(
  section_id UUID,
  section_title TEXT,
  source_table TEXT,
  source_id UUID,
  old_hash TEXT,
  new_hash TEXT
) AS $$
DECLARE
  sec RECORD;
  content_id UUID;
  computed_hash TEXT;
  existing_hash TEXT;
BEGIN
  FOR sec IN
    SELECT cs.id, cs.title_en, cs.content_source, cs.content_ids
    FROM public.course_sections cs
    JOIN public.courses c ON cs.course_id = c.id
    WHERE c.group_id = p_group_id
      AND cs.status = 'published'
      AND cs.content_source != 'custom'
  LOOP
    FOREACH content_id IN ARRAY sec.content_ids
    LOOP
      computed_hash := NULL;

      -- Per-table MD5 using actual column names
      IF sec.content_source = 'manual_sections' THEN
        SELECT md5(
          COALESCE(m.title_en, '') || COALESCE(m.title_es, '') ||
          COALESCE(m.content_en, '') || COALESCE(m.content_es, '')
        ) INTO computed_hash
        FROM public.manual_sections m WHERE m.id = content_id;

      ELSIF sec.content_source = 'foh_plate_specs' THEN
        SELECT md5(
          COALESCE(f.menu_name, '') || COALESCE(f.plate_type, '') ||
          COALESCE(f.short_description, '') || COALESCE(f.detailed_description, '') ||
          COALESCE(f.allergy_notes, '') || COALESCE(f.upsell_notes, '') ||
          COALESCE(f.notes, '') || COALESCE(array_to_string(f.ingredients, ','), '') ||
          COALESCE(array_to_string(f.key_ingredients, ','), '') ||
          COALESCE(array_to_string(f.flavor_profile, ','), '')
        ) INTO computed_hash
        FROM public.foh_plate_specs f WHERE f.id = content_id;

      ELSIF sec.content_source = 'plate_specs' THEN
        SELECT md5(
          COALESCE(ps.name, '') || COALESCE(ps.plate_type, '') ||
          COALESCE(ps.menu_category, '') || COALESCE(ps.notes, '') ||
          COALESCE(ps.components::text, '') || COALESCE(ps.assembly_procedure::text, '') ||
          COALESCE(array_to_string(ps.allergens, ','), '')
        ) INTO computed_hash
        FROM public.plate_specs ps WHERE ps.id = content_id;

      ELSIF sec.content_source = 'prep_recipes' THEN
        SELECT md5(
          COALESCE(pr.name, '') || COALESCE(pr.prep_type, '') ||
          COALESCE(pr.ingredients::text, '') || COALESCE(pr.procedure::text, '') ||
          COALESCE(pr.batch_scaling::text, '') || COALESCE(pr.training_notes::text, '') ||
          COALESCE(array_to_string(pr.tags, ','), '')
        ) INTO computed_hash
        FROM public.prep_recipes pr WHERE pr.id = content_id;

      ELSIF sec.content_source = 'wines' THEN
        SELECT md5(
          COALESCE(w.name, '') || COALESCE(w.producer, '') ||
          COALESCE(w.region, '') || COALESCE(w.varietal, '') ||
          COALESCE(w.style, '') || COALESCE(w.body, '') ||
          COALESCE(w.tasting_notes, '') || COALESCE(w.producer_notes, '') ||
          COALESCE(w.notes, '')
        ) INTO computed_hash
        FROM public.wines w WHERE w.id = content_id;

      ELSIF sec.content_source = 'cocktails' THEN
        SELECT md5(
          COALESCE(ct.name, '') || COALESCE(ct.style, '') ||
          COALESCE(ct.glass, '') || COALESCE(ct.ingredients, '') ||
          COALESCE(ct.key_ingredients, '') || COALESCE(ct.tasting_notes, '') ||
          COALESCE(ct.description, '') || COALESCE(ct.notes, '') ||
          COALESCE(ct.procedure::text, '')
        ) INTO computed_hash
        FROM public.cocktails ct WHERE ct.id = content_id;

      ELSIF sec.content_source = 'beer_liquor_list' THEN
        SELECT md5(
          COALESCE(bl.name, '') || COALESCE(bl.category, '') ||
          COALESCE(bl.subcategory, '') || COALESCE(bl.producer, '') ||
          COALESCE(bl.country, '') || COALESCE(bl.description, '') ||
          COALESCE(bl.style, '') || COALESCE(bl.notes, '')
        ) INTO computed_hash
        FROM public.beer_liquor_list bl WHERE bl.id = content_id;

      END IF;

      IF computed_hash IS NULL THEN CONTINUE; END IF;

      -- Get last known hash
      SELECT cl.content_hash INTO existing_hash
      FROM public.content_change_log cl
      WHERE cl.source_table = sec.content_source
        AND cl.source_id = content_id
      ORDER BY cl.created_at DESC
      LIMIT 1;

      -- First scan: create baseline, no change reported
      IF existing_hash IS NULL THEN
        INSERT INTO public.content_change_log (source_table, source_id, content_hash)
        VALUES (sec.content_source, content_id, computed_hash);
        CONTINUE;
      END IF;

      -- Hash differs: report the change
      IF computed_hash != existing_hash THEN
        section_id := sec.id;
        section_title := sec.title_en;
        source_table := sec.content_source;
        source_id := content_id;
        old_hash := existing_hash;
        new_hash := computed_hash;
        RETURN NEXT;
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### 4.2b. `expire_rollouts()` — Auto-Expire + Overdue Marking

```sql
CREATE OR REPLACE FUNCTION expire_rollouts()
RETURNS void AS $$
BEGIN
  UPDATE public.rollouts
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  UPDATE public.rollout_assignments ra
  SET status = 'overdue'
  FROM public.rollouts r
  WHERE ra.rollout_id = r.id
    AND r.status IN ('active', 'expired')
    AND r.deadline IS NOT NULL
    AND r.deadline < now()
    AND ra.status IN ('assigned', 'in_progress');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

#### 4.2c. `get_team_progress()` — Manager RPC for Team Data

```sql
CREATE OR REPLACE FUNCTION get_team_progress(p_group_id UUID)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT,
  courses_completed INTEGER,
  courses_total INTEGER,
  overall_progress_percent NUMERIC,
  average_quiz_score NUMERIC,
  last_active_at TIMESTAMPTZ,
  failed_sections TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.full_name,
    p.email,
    p.avatar_url,
    gm.role::TEXT,
    COALESCE(agg.completed, 0)::INTEGER AS courses_completed,
    COALESCE(agg.total, 0)::INTEGER AS courses_total,
    CASE WHEN COALESCE(agg.total, 0) > 0
      THEN ROUND((agg.completed::NUMERIC / agg.total) * 100, 1)
      ELSE 0
    END AS overall_progress_percent,
    agg.avg_score AS average_quiz_score,
    agg.last_active AS last_active_at,
    COALESCE(failed.sections, '{}') AS failed_sections
  FROM public.profiles p
  JOIN public.group_memberships gm ON gm.user_id = p.id AND gm.group_id = p_group_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE ce.status = 'completed') AS completed,
      COUNT(*) AS total,
      ROUND(AVG(ce.final_score) FILTER (WHERE ce.final_score IS NOT NULL), 1) AS avg_score,
      MAX(ce.updated_at) AS last_active
    FROM public.course_enrollments ce
    WHERE ce.user_id = p.id AND ce.group_id = p_group_id
  ) agg ON true
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(cs.title_en) AS sections
    FROM public.section_progress sp
    JOIN public.course_sections cs ON cs.id = sp.section_id
    WHERE sp.user_id = p.id
      AND sp.quiz_passed = false
      AND sp.quiz_score IS NOT NULL
  ) failed ON true
  WHERE p.is_active = true
  ORDER BY overall_progress_percent ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Deploy**: `npx supabase db push`

**Verify**:
```sql
SELECT * FROM get_team_progress('GROUP_ID');
SELECT * FROM detect_content_changes('GROUP_ID');
```

---

### Step 4.3 — Extend `course-evaluate` Edge Function: Add `course_final` Action

**File**: `supabase/functions/course-evaluate/index.ts` (MODIFY)

The existing edge function supports `grade_mc`, `grade_voice`, and `section_evaluation`. Phase 4 needs a new `course_final` action that generates a comprehensive AI evaluation across ALL of a student's courses — used by the "Generate AI Insight" button in the manager dashboard.

**Add new handler**:

```typescript
case "course_final":
  return await handleCourseFinal(supabase, userId, groupId, body, language);
```

#### `handleCourseFinal()` Flow:

1. Auth: Verify calling user has `manager` or `admin` role (via `get_user_role()` RPC)
2. Accept `target_user_id` from request body (the staff member being evaluated)
3. Fetch all `course_enrollments` for `target_user_id` in the group
4. Fetch all `section_progress` with quiz scores
5. Fetch all existing `evaluations` (quiz-level) for context
6. Check for cached `course_final` evaluation (created_at < 24h ago) — if found, return cached
7. Load `quiz-section-evaluation` prompt from `ai_prompts`
8. Call OpenAI with comprehensive context:
   - All course completion percentages
   - All quiz scores per section
   - Failed sections list
   - Time spent data
9. Generate dual feedback:
   - `student_feedback`: Overall encouragement + growth areas
   - `manager_feedback`: Competency gaps, recommended pairings, risk level
10. Insert into `evaluations` with `eval_type: 'course_final'`
11. Return full evaluation (both student + manager feedback, since caller is manager)

**Request**:
```typescript
{
  action: 'course_final',
  target_user_id: string,  // Staff member to evaluate
  language: 'en' | 'es',
  groupId: string,
}
```

**Response**:
```typescript
{
  competency_level: 'novice' | 'competent' | 'proficient' | 'expert',
  student_feedback: { strengths: string[], areas_for_improvement: string[], encouragement: string },
  manager_feedback: { competency_gaps: string[], recommended_actions: string[], risk_level: string },
  cached: boolean,
}
```

**Deploy**: `npx supabase functions deploy course-evaluate`

---

### Step 4.4 — Hook: `use-team-training.ts`

**File**: `src/hooks/use-team-training.ts` (NEW, ~130 lines)

Fetches team-wide training data via `get_team_progress` RPC + course stats aggregation.

```typescript
export function useTeamTraining() {
  const { user, permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;

  const { data, isLoading, error } = useQuery({
    queryKey: ['team-training', groupId],
    queryFn: async () => {
      if (!groupId) return { members: [], courseStats: [], summary: null };

      // Batch: team progress RPC + courses + enrollments + overdue assignments
      const [teamRes, coursesRes, enrollmentsRes, overdueRes] = await Promise.all([
        supabase.rpc('get_team_progress', { p_group_id: groupId }),
        supabase.from('courses').select('id, title_en').eq('group_id', groupId).eq('status', 'published'),
        supabase.from('course_enrollments').select('course_id, status, final_score').eq('group_id', groupId),
        supabase.from('rollout_assignments').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
      ]);

      if (teamRes.error) throw new Error(teamRes.error.message);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Transform team members with computed status
      const members: TeamMemberProgress[] = (teamRes.data ?? []).map((m) => {
        let status: TeamMemberStatus = 'on_track';
        if (!m.last_active_at || m.last_active_at < sevenDaysAgo) status = 'inactive';
        else if (m.overall_progress_percent < 50 && m.courses_total > 0) status = 'behind';

        return {
          userId: m.user_id, fullName: m.full_name, email: m.email,
          avatarUrl: m.avatar_url, role: m.role,
          coursesCompleted: m.courses_completed, coursesTotal: m.courses_total,
          overallProgressPercent: Number(m.overall_progress_percent),
          averageQuizScore: m.average_quiz_score ? Number(m.average_quiz_score) : null,
          competencyLevel: null,
          lastActiveAt: m.last_active_at, failedSections: m.failed_sections ?? [],
          status,
        };
      });

      // Aggregate course stats
      const courseStats: CourseStats[] = (coursesRes.data ?? []).map((c) => {
        const ce = (enrollmentsRes.data ?? []).filter(e => e.course_id === c.id);
        const done = ce.filter(e => e.status === 'completed').length;
        const scores = ce.filter(e => e.final_score != null).map(e => e.final_score!);
        return {
          courseId: c.id, courseTitle: c.title_en,
          enrolledCount: ce.length, completedCount: done,
          averageScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          completionPercent: ce.length > 0 ? Math.round((done / ce.length) * 100) : 0,
        };
      });

      const activeCount = members.filter(m => m.status !== 'inactive').length;
      const summary: DashboardSummary = {
        totalStaff: members.length,
        activeStaff: activeCount,
        teamAverage: members.length > 0
          ? Math.round(members.reduce((s, m) => s + m.overallProgressPercent, 0) / members.length)
          : 0,
        coursesPublished: coursesRes.data?.length ?? 0,
        overdueTasks: overdueRes.count ?? 0,
      };

      return { members, courseStats, summary };
    },
    enabled: !!groupId && isManager,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    members: data?.members ?? [],
    courseStats: data?.courseStats ?? [],
    summary: data?.summary ?? null,
    isLoading,
    error,
  };
}
```

---

### Step 4.5 — Component: `CompetencyBadge.tsx`

**File**: `src/components/training/CompetencyBadge.tsx` (NEW, ~40 lines)

Props: `{ level: 'novice' | 'competent' | 'proficient' | 'expert' | null, size?: 'sm' | 'md', language: 'en' | 'es' }`

Color mapping:
- `novice` → red (`bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400`)
- `competent` → amber
- `proficient` → blue
- `expert` → green
- `null` → gray "N/A"

Uses existing `Badge` component. Bilingual labels (e.g., "Novice" / "Principiante").

---

### Step 4.6 — Component: `DashboardStats.tsx`

**File**: `src/components/training/DashboardStats.tsx` (NEW, ~80 lines)

Props: `{ summary: DashboardSummary | null, language: 'en' | 'es' }`

4 stat cards in responsive `grid grid-cols-2 md:grid-cols-4`:

| Card | Icon | Value | Subtitle |
|------|------|-------|----------|
| Team | `Users` | totalStaff | "{activeStaff} active" |
| Progress | `TrendingUp` | teamAverage% | "avg progress" |
| Courses | `BookOpen` | coursesPublished | "published" |
| Overdue | `AlertTriangle` | overdueTasks | "overdue tasks" |

Overdue card: amber border if > 0, red border if > 5.

---

### Step 4.7 — Component: `TeamProgressTable.tsx`

**File**: `src/components/training/TeamProgressTable.tsx` (NEW, ~150 lines)

Props:
```typescript
interface TeamProgressTableProps {
  members: TeamMemberProgress[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  language: 'en' | 'es';
}
```

Uses shadcn `Table` components. Sorted by progress ascending ("needs attention" first).

| Column | Mobile | Tablet+ |
|--------|--------|---------|
| Status dot + Name | Always | Always |
| Progress bar + % | Always | Always |
| Quiz Avg | Hidden | Shown |
| Status label | Hidden | Shown |
| Last Active (relative) | Hidden | Shown |

Status dot colors: green (`on_track`), amber (`behind`), gray (`inactive`).
Selected row: `bg-muted` highlight.
Tap row → `onSelectUser(userId)`.

---

### Step 4.8 — Component: `ServerDetailPanel.tsx`

**File**: `src/components/training/ServerDetailPanel.tsx` (NEW, ~220 lines)

Props: `{ member: TeamMemberProgress | null, language: 'en' | 'es' }`

Internal `useQuery` fetches section-level detail for the selected user:
- All `section_progress` rows joined with `course_sections` for titles
- Latest `evaluations` where `eval_type IN ('quiz', 'course_final')` for competency data
- Conversation count from `course_conversations` (for "View Conversations" link)

**Layout**:
```
┌─────────────────────────────────────┐
│ Jane Doe                            │
│ staff · Last active: 2 days ago     │
│ ████░░░░░░░░░ 35%  · Quiz Avg: 62  │
│                                     │
│ ─── Course Progress ────────────    │
│ ✅ Culture & Standards   Quiz: 85%  │
│ ✅ Entrees & Steaks      Quiz: 78%  │
│ ❌ Wine Program          Quiz: 45%  │
│ ⬜ Cocktails             Not started │
│                                     │
│ ─── Failed Sections ───────────     │
│ ⚠ Wine Program — Score: 45%        │
│   Gaps: Wine temps, pairing conf.   │
│                                     │
│ ─── Conversations ─────────────     │
│ 12 learning sessions                │
│ [View History →]                    │
│                                     │
│ ─── Manager Notes ─────────────     │
│ [textarea: Add note...          ]   │
│ [Save Note]                         │
│                                     │
│ [Generate AI Insight]               │
└─────────────────────────────────────┘
```

**Key features**:
- Section breakdown with status icons (checkmark/x/empty) and quiz scores
- Failed sections highlighted with competency gaps from `evaluations.manager_feedback`
- "View History" link to conversation sessions (navigates or opens sheet)
- Manager notes textarea + save (mutates `evaluations.manager_notes`)
- "Generate AI Insight" calls `course-evaluate` with `action: 'course_final'` + `target_user_id`
- Result cached 24h (checks `evaluations.created_at` before calling AI)

**Manager Notes mutation**:
```typescript
const saveNotes = async (evaluationId: string, notes: string) => {
  await supabase.from('evaluations').update({ manager_notes: notes }).eq('id', evaluationId);
  queryClient.invalidateQueries({ queryKey: ['member-detail'] });
};
```

---

### Step 4.9 — Page: `ManagerTrainingDashboard.tsx`

**File**: `src/pages/ManagerTrainingDashboard.tsx` (NEW, ~220 lines)

**URL**: `/admin/training` (manager + admin only, matches master plan)

3 tabs via shadcn `Tabs`:

#### Tab 1: Overview
- `DashboardStats` summary cards
- Content changes alert panel (from `useContentChanges`, wired in Step 4.16)
- Recharts `BarChart` showing course completion rates
- Recent evaluations list (last 5, with competency badges)

#### Tab 2: By Server (split view)
- iPad (`md:`): CSS grid `grid-template-columns: 2fr 3fr`
  - Left: `TeamProgressTable`
  - Right: `ServerDetailPanel`
- Phone: `TeamProgressTable` fills screen, tap → `Sheet` with `ServerDetailPanel`

```typescript
const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
const selectedMember = members.find(m => m.userId === selectedUserId) ?? null;

// iPad:
<div className="hidden md:grid md:grid-cols-[2fr_3fr] md:gap-4">
  <TeamProgressTable members={members} selectedUserId={selectedUserId}
    onSelectUser={setSelectedUserId} language={language} />
  <ServerDetailPanel member={selectedMember} language={language} />
</div>

// Phone:
<div className="md:hidden">
  <TeamProgressTable members={members} selectedUserId={null}
    onSelectUser={(id) => { setSelectedUserId(id); setSheetOpen(true); }} language={language} />
  <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
    <SheetContent side="bottom" className="h-[85vh]">
      <ServerDetailPanel member={selectedMember} language={language} />
    </SheetContent>
  </Sheet>
</div>
```

#### Tab 3: Rollouts
Placeholder initially → populated in Step 4.14.

---

### Step 4.10 — Route + Navigation Updates

#### Modify `src/App.tsx`

Add route (near existing `/admin` route):
```tsx
<Route path="/admin/training" element={
  <ProtectedRoute requiredRole="manager"><ManagerTrainingDashboard /></ProtectedRoute>
} />
```

#### Modify `src/lib/constants.ts`

```typescript
ADMIN_TRAINING: '/admin/training',
ADMIN_ROLLOUT_NEW: '/admin/training/rollout/new',
```

#### Modify `src/components/layout/Sidebar.tsx`

Add `BarChart3` to `iconMap` (line ~8-21).

Add nav item to the admin hardcoded array (line ~39-49) and `ADMIN_NAV_ITEMS` in constants:
```typescript
{ path: '/admin/training', label: 'Training Dashboard', icon: 'BarChart3' }
```

Place it in the secondary section near `/admin` so managers see it. Gate with `isManager || isAdmin`.

---

### Step 4.11 — Hook: `use-rollouts.ts`

**File**: `src/hooks/use-rollouts.ts` (NEW, ~200 lines)

CRUD for rollouts and assignments. Follows existing React Query patterns.

```typescript
export function useRollouts() {
  const { user, permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const queryClient = useQueryClient();

  // ─── READ ─────────────────────────────────────────────────────
  const { data: rollouts = [], isLoading, error } = useQuery({
    queryKey: ['rollouts', groupId],
    queryFn: async (): Promise<RolloutWithProgress[]> => {
      if (!groupId) return [];

      const [rolloutsRes, assignmentsRes] = await Promise.all([
        supabase.from('rollouts').select('*').eq('group_id', groupId)
          .order('created_at', { ascending: false }),
        supabase.from('rollout_assignments').select('rollout_id, status'),
      ]);
      if (rolloutsRes.error) throw new Error(rolloutsRes.error.message);

      const aMap = new Map<string, { total: number; completed: number; overdue: number }>();
      for (const a of assignmentsRes.data ?? []) {
        const cur = aMap.get(a.rollout_id) ?? { total: 0, completed: 0, overdue: 0 };
        cur.total++;
        if (a.status === 'completed') cur.completed++;
        if (a.status === 'overdue') cur.overdue++;
        aMap.set(a.rollout_id, cur);
      }

      return rolloutsRes.data.map((raw) => {
        const agg = aMap.get(raw.id) ?? { total: 0, completed: 0, overdue: 0 };
        return {
          ...transformRollout(raw),
          totalAssignees: agg.total,
          completedAssignees: agg.completed,
          overdueAssignees: agg.overdue,
          progressPercent: agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0,
        };
      });
    },
    enabled: !!groupId && isManager,
    staleTime: 5 * 60 * 1000,
  });

  // ─── CREATE ───────────────────────────────────────────────────
  const createRollout = useCallback(async (data: {
    name: string; description?: string; courseIds: string[];
    sectionIds?: string[]; deadline?: string; expiresAt?: string;
    assigneeIds: string[];
  }) => {
    if (!groupId || !user) throw new Error('Not authenticated');

    const { data: rollout, error: err } = await supabase
      .from('rollouts')
      .insert({
        group_id: groupId, name: data.name,
        description: data.description ?? null,
        course_ids: data.courseIds, section_ids: data.sectionIds ?? [],
        deadline: data.deadline ?? null, expires_at: data.expiresAt ?? null,
        status: 'active', created_by: user.id,
      })
      .select('id').single();
    if (err) throw new Error(err.message);

    if (data.assigneeIds.length > 0) {
      const rows = data.assigneeIds.map(uid => ({
        rollout_id: rollout.id, user_id: uid,
        status: 'assigned' as const, total_courses: data.courseIds.length,
      }));
      const { error: aErr } = await supabase.from('rollout_assignments').insert(rows);
      if (aErr) throw new Error(aErr.message);
    }

    queryClient.invalidateQueries({ queryKey: ['rollouts', groupId] });
    return rollout.id;
  }, [groupId, user, queryClient]);

  // ─── ARCHIVE ──────────────────────────────────────────────────
  const archiveRollout = useCallback(async (rolloutId: string) => {
    await supabase.from('rollouts').update({ status: 'archived' }).eq('id', rolloutId);
    queryClient.invalidateQueries({ queryKey: ['rollouts', groupId] });
  }, [groupId, queryClient]);

  return {
    rollouts,
    activeRollouts: rollouts.filter(r => r.status === 'active'),
    isLoading, error,
    createRollout, archiveRollout,
  };
}
```

---

### Step 4.12 — Component: `RolloutCard.tsx`

**File**: `src/components/training/RolloutCard.tsx` (NEW, ~80 lines)

Props: `{ rollout: RolloutWithProgress, onClick: () => void, language: 'en' | 'es' }`

```
┌─────────────────────────────────────┐
│ Server 101 Training Rollout          │
│ [ACTIVE]  Deadline: Mar 15, 2026    │
│ ████████░░░░░ 65%                   │
│ 8/12 completed · 2 overdue          │
│ 3 courses · Created Feb 10          │
└─────────────────────────────────────┘
```

Status badge colors: ACTIVE (green), DRAFT (gray), EXPIRED (red), COMPLETED (blue), ARCHIVED (muted).

---

### Step 4.13 — Component: `RolloutWizard.tsx`

**File**: `src/components/training/RolloutWizard.tsx` (NEW, ~300 lines)

Props: `{ open: boolean, onClose: () => void }`

5-step wizard in a `Dialog`:

| Step | Content | Data Source |
|------|---------|-------------|
| 1. Basics | Name + description inputs | Local state |
| 2. Courses | Checkbox list of published courses | `useCourses()` hook |
| 3. Deadline | Date pickers for deadline + expiry | `<input type="date">` |
| 4. Assign | Quick picks (All Staff / Custom) + user checkboxes | `group_memberships` query |
| 5. Review | Summary of selections + [Create Rollout] button | All local state |

Navigation: [Back] / [Next] buttons, step indicator dots at top.
On submit: calls `createRollout()` from `use-rollouts.ts`, shows toast, closes dialog.

---

### Step 4.14 — Wire Rollouts Tab in Dashboard

**File**: `src/pages/ManagerTrainingDashboard.tsx` (MODIFY)

Populate the "Rollouts" tab:
```tsx
<TabsContent value="rollouts">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold">
      {language === 'es' ? 'Rollouts de Entrenamiento' : 'Training Rollouts'}
    </h2>
    <Button onClick={() => setShowWizard(true)}>
      {language === 'es' ? 'Nuevo Rollout' : 'New Rollout'}
    </Button>
  </div>

  {rollouts.length === 0 && <EmptyState message="No rollouts yet" />}

  <div className="space-y-3">
    {rollouts.map(r => (
      <RolloutCard key={r.id} rollout={r} onClick={() => {}} language={language} />
    ))}
  </div>

  <RolloutWizard open={showWizard} onClose={() => setShowWizard(false)} />
</TabsContent>
```

---

### Step 4.15 — Staff-Facing Rollout Banner + Hook

**File**: `src/hooks/use-my-rollouts.ts` (NEW, ~50 lines)

Fetches the current user's active rollout assignments:
```typescript
export function useMyRollouts() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const { data: assignments = [] } = useQuery({
    queryKey: ['my-rollouts', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('rollout_assignments')
        .select('id, status, rollout_id, rollouts(name, deadline)')
        .eq('user_id', userId)
        .in('status', ['assigned', 'in_progress']);
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
  });

  return { assignments };
}
```

**File**: `src/pages/TrainingHome.tsx` (MODIFY)

Add rollout deadline banner at top:
```typescript
import { useMyRollouts } from '@/hooks/use-my-rollouts';

// Inside component:
const { assignments } = useMyRollouts();
const activeRollout = assignments[0]; // Show nearest deadline

// Render before program cards:
{activeRollout?.rollouts?.deadline && (
  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
      📋 {activeRollout.rollouts.name} —
      {language === 'es'
        ? ` Completa antes del ${formatDate(activeRollout.rollouts.deadline)}`
        : ` Complete by ${formatDate(activeRollout.rollouts.deadline)}`}
    </p>
  </div>
)}
```

---

### Step 4.16 — Hook: `use-content-changes.ts`

**File**: `src/hooks/use-content-changes.ts` (NEW, ~100 lines)

```typescript
export function useContentChanges() {
  const { permissions, isManager } = useAuth();
  const groupId = permissions?.memberships?.[0]?.groupId ?? null;
  const queryClient = useQueryClient();

  const { data: changes = [], isLoading, error } = useQuery({
    queryKey: ['content-changes', groupId],
    queryFn: async (): Promise<ContentChangeWithContext[]> => {
      if (!groupId) return [];

      const { data, error } = await supabase
        .rpc('detect_content_changes', { p_group_id: groupId });
      if (error) throw new Error(error.message);

      // Enrich each change with affected student count
      return Promise.all((data ?? []).map(async (row) => {
        const { count } = await supabase
          .from('section_progress')
          .select('id', { count: 'exact', head: true })
          .eq('section_id', row.section_id)
          .eq('status', 'completed');

        return {
          sectionId: row.section_id,
          sectionTitle: row.section_title,
          sourceTable: row.source_table,
          sourceId: row.source_id,
          oldHash: row.old_hash,
          newHash: row.new_hash,
          affectedStudents: count ?? 0,
        };
      }));
    },
    enabled: !!groupId && isManager,
    staleTime: 10 * 60 * 1000,
  });

  const acknowledge = useCallback(async (sourceTable: string, sourceId: string, newHash: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('content_change_log').insert({
      source_table: sourceTable,
      source_id: sourceId,
      content_hash: newHash,
      acknowledged_by: user?.id,
      acknowledged_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['content-changes', groupId] });
  }, [groupId, queryClient]);

  return { changes, unacknowledgedCount: changes.length, isLoading, error, acknowledge };
}
```

---

### Step 4.17 — Content Changes Panel + Quiz Regen in Dashboard

**File**: `src/pages/ManagerTrainingDashboard.tsx` (MODIFY)

Add to Overview tab, below DashboardStats:

```typescript
{changes.length > 0 && (
  <Card className="border-amber-200 dark:border-amber-800">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-5 w-5" />
        {language === 'es' ? 'Contenido Actualizado' : 'Content Updated'}
        <Badge variant="secondary">{changes.length}</Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {changes.map(change => (
        <div key={`${change.sourceTable}-${change.sourceId}`}
          className="flex justify-between items-center py-2 border-b last:border-0">
          <div>
            <p className="text-sm font-medium">{change.sectionTitle}</p>
            <p className="text-xs text-muted-foreground">
              {change.affectedStudents} {language === 'es' ? 'completaron con version anterior' : 'completed with old version'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              onClick={() => acknowledge(change.sourceTable, change.sourceId, change.newHash)}>
              {language === 'es' ? 'Reconocer' : 'Acknowledge'}
            </Button>
          </div>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

**Design decisions**:
- Student completions are NEVER auto-reset (per master plan 7.4)
- Manager can: Acknowledge (dismiss), or manually create a refresh rollout via Rollouts tab
- Quiz regeneration: Manager can use `force_regenerate: true` on `course-quiz-generate` for affected sections (button in ServerDetailPanel, calls existing edge function)

---

### Step 4.18 — Data Retention: Integrate `expire_rollouts()` + Cron

**File**: `supabase/migrations/YYYYMMDDHHMMSS_integrate_rollout_expiry.sql` (NEW)

The existing `cleanup_expired_training_data()` function (from Phase 1) deletes expired conversations and redacts transcriptions. Add `expire_rollouts()` integration:

```sql
-- Update cleanup function to also expire rollouts
CREATE OR REPLACE FUNCTION cleanup_expired_training_data()
RETURNS void AS $$
BEGIN
  -- 1. Delete expired conversations (keep flagged ones)
  DELETE FROM public.course_conversations
  WHERE expires_at < now()
    AND is_flagged = false;

  -- 2. Null out expired voice transcriptions
  UPDATE public.quiz_attempt_answers
  SET transcription = NULL
  WHERE transcription_expires_at IS NOT NULL
    AND transcription_expires_at < now()
    AND transcription IS NOT NULL;

  -- 3. Expire rollouts and mark overdue assignments
  PERFORM public.expire_rollouts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Cron scheduling** (run manually via Supabase SQL editor or pg_cron if enabled):
```sql
-- Daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-training-data',
  '0 3 * * *',
  'SELECT public.cleanup_expired_training_data()'
);
```

**Note**: If pg_cron is not enabled on the project, this can be triggered via a Supabase edge function on a cron schedule instead.

**Deploy**: `npx supabase db push`

---

### Step 4.19 — Update Admin Page

**File**: `src/pages/Admin.tsx` (MODIFY)

Replace placeholder stats with a link card to the dashboard:

```typescript
<Card className="cursor-pointer hover:shadow-md transition-shadow"
  onClick={() => navigate('/admin/training')}>
  <CardContent className="flex items-center gap-4 py-6">
    <BarChart3 className="h-8 w-8 text-primary" />
    <div>
      <p className="font-medium">{language === 'es' ? 'Dashboard de Entrenamiento' : 'Training Dashboard'}</p>
      <p className="text-sm text-muted-foreground">
        {language === 'es' ? 'Ver progreso del equipo y gestionar rollouts' : 'View team progress and manage rollouts'}
      </p>
    </div>
    <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
  </CardContent>
</Card>
```

---

### Step 4.20 — TypeScript Check + Security Audit

1. **TypeScript compilation**: `npx tsc --noEmit` → expect 0 errors
2. **Security advisors**: `mcp__supabase__get_advisors --type security` → expect clean
3. **Performance advisors**: `mcp__supabase__get_advisors --type performance` → review
4. **RLS verification**: Test with manager role — all group data visible, no cross-group leaks
5. **Student isolation**: Staff cannot access `/admin/training` (ProtectedRoute blocks)
6. **Edge function**: `course-evaluate` v3 deployed with `course_final` action working

---

## Alignment Notes

### Manager Feedback is Hidden from Students
`evaluations.manager_feedback` and `manager_notes` are only returned by `course-evaluate` when the caller has manager/admin role. Student-facing responses omit these fields. RLS policies allow managers to see all group evaluations.

### Content Changes Never Auto-Reset
`detect_content_changes()` only reports — it never modifies `section_progress` or `quiz_attempts`. The manager must:
1. **Acknowledge** → logs new hash in `content_change_log`, clears notification
2. **Create refresh rollout** → uses RolloutWizard targeting affected courses/sections
3. **Regenerate quizzes** → calls `course-quiz-generate` with `force_regenerate: true`

### Rollout Expiry is Automated
`expire_rollouts()` runs daily via `cleanup_expired_training_data()` cron job. Also callable on-demand from the dashboard. Overdue assignments are marked automatically.

### iPad Split View
"By Server" tab uses `grid-template-columns: 2fr 3fr` on `md:`. Phone uses `Sheet` (bottom slide-up, 85vh). Clean separation — `TeamProgressTable` and `ServerDetailPanel` are independent components.

### AI Insight Generation
"Generate AI Insight" in `ServerDetailPanel` calls `course-evaluate` with `action: 'course_final'` and `target_user_id`. Result is cached in `evaluations` table. 24-hour cache check: if `evaluations` row with `eval_type='course_final'` and matching `user_id` exists with `created_at > now() - 24h`, return cached instead of calling OpenAI.

### Conversation History
`ServerDetailPanel` shows conversation count and a "View History" link. This links to a filtered view of `course_conversations` for the selected user (read-only for managers). Implementation: inline list or navigate to a dedicated sub-page.

---

## File Inventory

| # | File | Lines | Type |
|---|------|-------|------|
| 1 | `src/types/dashboard.ts` | ~220 | NEW |
| 2 | `supabase/migrations/YYYYMMDDHHMMSS_management_functions.sql` | ~180 | NEW |
| 3 | `supabase/functions/course-evaluate/index.ts` | +80 | MODIFY (add course_final) |
| 4 | `src/hooks/use-team-training.ts` | ~130 | NEW |
| 5 | `src/components/training/CompetencyBadge.tsx` | ~40 | NEW |
| 6 | `src/components/training/DashboardStats.tsx` | ~80 | NEW |
| 7 | `src/components/training/TeamProgressTable.tsx` | ~150 | NEW |
| 8 | `src/components/training/ServerDetailPanel.tsx` | ~220 | NEW |
| 9 | `src/pages/ManagerTrainingDashboard.tsx` | ~220 | NEW |
| 10 | `src/hooks/use-rollouts.ts` | ~200 | NEW |
| 11 | `src/components/training/RolloutCard.tsx` | ~80 | NEW |
| 12 | `src/components/training/RolloutWizard.tsx` | ~300 | NEW |
| 13 | `src/hooks/use-my-rollouts.ts` | ~50 | NEW |
| 14 | `src/hooks/use-content-changes.ts` | ~100 | NEW |
| 15 | `supabase/migrations/YYYYMMDDHHMMSS_integrate_rollout_expiry.sql` | ~20 | NEW |
| 16 | `src/App.tsx` | +5 | MODIFY |
| 17 | `src/lib/constants.ts` | +2 | MODIFY |
| 18 | `src/components/layout/Sidebar.tsx` | +10 | MODIFY |
| 19 | `src/pages/TrainingHome.tsx` | +20 | MODIFY |
| 20 | `src/pages/Admin.tsx` | +15 | MODIFY |

**Total**: 15 new files, 5 modified files, ~2,150 new lines

---

## Verification Checklist

### Database
- [ ] `detect_content_changes()` deployed with per-table CASE (7 tables, actual column names)
- [ ] `expire_rollouts()` deployed and marks expired/overdue correctly
- [ ] `get_team_progress()` RPC returns team data sorted by progress ascending
- [ ] `cleanup_expired_training_data()` updated to call `expire_rollouts()`
- [ ] All functions use `SECURITY DEFINER SET search_path = public`
- [ ] Security advisors clean

### Edge Function
- [ ] `course-evaluate` v3 deployed with `course_final` action
- [ ] `course_final` validates caller is manager/admin
- [ ] `course_final` caches result in evaluations table for 24h
- [ ] `course_final` returns both student + manager feedback to managers

### Manager Dashboard
- [ ] `/admin/training` accessible to managers and admins only
- [ ] Staff blocked by `ProtectedRoute requiredRole="manager"`
- [ ] Overview: DashboardStats shows real counts
- [ ] Overview: Content changes alert panel with acknowledge buttons
- [ ] Overview: Course completion bar chart (Recharts)
- [ ] Overview: Recent evaluations list with CompetencyBadge
- [ ] By Server: TeamProgressTable sorted "needs attention" first
- [ ] By Server: Tap → ServerDetailPanel with section breakdown
- [ ] By Server: iPad 40/60 split, phone Sheet (85vh)
- [ ] ServerDetailPanel: Failed sections with competency gaps
- [ ] ServerDetailPanel: Manager notes save/load
- [ ] ServerDetailPanel: "Generate AI Insight" → cached course_final
- [ ] ServerDetailPanel: Conversation history count + view link
- [ ] Sidebar: "Training Dashboard" nav item for managers/admins only

### Rollout System
- [ ] RolloutWizard 5-step flow creates rollout + assignments
- [ ] Courses selectable via checkbox list
- [ ] Users assignable individually or "All Staff" quick-pick
- [ ] Deadline + expiry date pickers
- [ ] RolloutCard shows progress, overdue count, status badge
- [ ] Staff see deadline banner on TrainingHome (via `useMyRollouts`)
- [ ] `expire_rollouts()` auto-marks expired + overdue daily

### Content Change Detection
- [ ] `detect_content_changes()` scans all 7 source tables correctly
- [ ] First scan creates hash baselines (no false positives)
- [ ] Changed content shows amber alert in dashboard
- [ ] Affected student count per change
- [ ] Acknowledge inserts into `content_change_log`
- [ ] Student completions NEVER auto-reset

### TypeScript
- [ ] 0 TypeScript errors
- [ ] All types exported from `src/types/dashboard.ts`
- [ ] Transform functions handle null/undefined
